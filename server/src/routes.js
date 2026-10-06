import { Router } from 'express';
import { query } from './db.js';

const router = Router();

// Middleware helper to validate integer IDs
function parseId(paramVal) {
  const id = Number(paramVal);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

// ==========================================
// 1. GET /api/projects/:projectId/board
// ==========================================
router.get('/projects/:projectId/board', async (req, res) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID. Must be a positive integer.' });
    }

    // Check project exists
    const projectRes = await query('SELECT id, name, created_at FROM projects WHERE id = $1', [projectId]);
    if (projectRes.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectRes.rows[0];

    // Priority filter validation
    const { priority } = req.query;
    let tasksQuery = 'SELECT * FROM tasks WHERE project_id = $1';
    const tasksParams = [projectId];

    if (priority) {
      const normalizedPriority = String(priority).toLowerCase().trim();
      if (!['low', 'medium', 'high'].includes(normalizedPriority)) {
        return res.status(400).json({
          error: 'Invalid priority filter. Allowed values: low, medium, high'
        });
      }
      tasksQuery += ' AND priority = $2';
      tasksParams.push(normalizedPriority);
    }
    tasksQuery += ' ORDER BY id ASC';

    // Fetch tasks
    const tasksRes = await query(tasksQuery, tasksParams);

    // Fetch project members
    const membersRes = await query(`
      SELECT u.id, u.name, u.email, u.avatar_color, pu.role, u.created_at
      FROM project_users pu
      JOIN users u ON pu.user_id = u.id
      WHERE pu.project_id = $1
      ORDER BY u.id ASC
    `, [projectId]);

    // Workload calculation (in-progress count per user in this project)
    const inProgressRes = await query(`
      SELECT assigned_user_id, COUNT(*)::int as count
      FROM tasks
      WHERE project_id = $1 AND status = 'in_progress' AND assigned_user_id IS NOT NULL
      GROUP BY assigned_user_id
    `, [projectId]);

    const inProgressMap = {};
    for (const row of inProgressRes.rows) {
      inProgressMap[row.assigned_user_id] = row.count;
    }

    // Workload rule: workloadWarning = inProgressTaskCount > 5
    const workload = membersRes.rows.map(user => {
      const count = inProgressMap[user.id] || 0;
      return {
        userId: user.id,
        user_id: user.id,
        userName: user.name,
        inProgressTaskCount: count,
        workloadWarning: count > 5
      };
    });

    const users = membersRes.rows.map(user => {
      const count = inProgressMap[user.id] || 0;
      return {
        ...user,
        inProgressTaskCount: count,
        workloadWarning: count > 5
      };
    });

    return res.status(200).json({
      project,
      tasks: tasksRes.rows,
      users,
      workload
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    return res.status(500).json({ error: 'Internal server error while fetching board' });
  }
});

// ==========================================
// 2. POST /api/projects/:projectId/tasks
// ==========================================
router.post('/projects/:projectId/tasks', async (req, res) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID. Must be a positive integer.' });
    }

    const {
      title,
      description,
      priority = 'medium',
      dueDate,
      due_date,
      assignedUserId,
      assigned_user_id,
      status = 'todo'
    } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required and must not be empty' });
    }

    // Validate priority
    const normalizedPriority = String(priority).toLowerCase().trim();
    if (!['low', 'medium', 'high'].includes(normalizedPriority)) {
      return res.status(400).json({ error: 'Priority must be one of: low, medium, high' });
    }

    // Validate status
    const normalizedStatus = String(status).toLowerCase().trim();
    if (!['todo', 'in_progress', 'done'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Status must be one of: todo, in_progress, done' });
    }

    // Check project exists
    const projectRes = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectRes.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate assigned user if supplied
    const targetUserId = assignedUserId !== undefined ? assignedUserId : assigned_user_id;
    let finalAssignedUserId = null;

    if (targetUserId !== undefined && targetUserId !== null && targetUserId !== '') {
      const uid = parseId(targetUserId);
      if (!uid) {
        return res.status(400).json({ error: 'assignedUserId must be a valid positive integer' });
      }

      // Check user exists
      const userRes = await query('SELECT id FROM users WHERE id = $1', [uid]);
      if (userRes.rowCount === 0) {
        return res.status(404).json({ error: 'Assigned user does not exist' });
      }

      // Check if user belongs to project
      const memberRes = await query('SELECT id FROM project_users WHERE project_id = $1 AND user_id = $2', [projectId, uid]);
      if (memberRes.rowCount === 0) {
        return res.status(400).json({ error: 'Assigned user does not belong to this project' });
      }

      finalAssignedUserId = uid;
    }

    // Parse due date if provided
    const rawDueDate = dueDate !== undefined ? dueDate : due_date;
    let finalDueDate = null;
    if (rawDueDate) {
      const parsedDate = new Date(rawDueDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid due date format' });
      }
      finalDueDate = parsedDate;
    }

    const insertRes = await query(`
      INSERT INTO tasks (
        project_id,
        assigned_user_id,
        title,
        description,
        priority,
        status,
        due_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      projectId,
      finalAssignedUserId,
      title.trim(),
      description ? String(description).trim() : null,
      normalizedPriority,
      normalizedStatus,
      finalDueDate
    ]);

    return res.status(201).json(insertRes.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Internal server error while creating task' });
  }
});

// ==========================================
// 3. PATCH /api/tasks/:taskId
// ==========================================
router.patch('/tasks/:taskId', async (req, res) => {
  try {
    const taskId = parseId(req.params.taskId);
    if (!taskId) {
      return res.status(400).json({ error: 'Invalid task ID. Must be a positive integer.' });
    }

    // Check task exists
    const taskRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const currentTask = taskRes.rows[0];

    const {
      title,
      description,
      priority,
      status,
      dueDate,
      due_date,
      assignedUserId,
      assigned_user_id
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Validate title if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updates.push(`title = $${paramIndex++}`);
      values.push(title.trim());
    }

    // Validate description if provided
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description !== null ? String(description).trim() : null);
    }

    // Validate priority if provided
    if (priority !== undefined) {
      const normalizedPriority = String(priority).toLowerCase().trim();
      if (!['low', 'medium', 'high'].includes(normalizedPriority)) {
        return res.status(400).json({ error: 'Priority must be one of: low, medium, high' });
      }
      updates.push(`priority = $${paramIndex++}`);
      values.push(normalizedPriority);
    }

    // Validate status if provided
    if (status !== undefined) {
      const normalizedStatus = String(status).toLowerCase().trim();
      if (!['todo', 'in_progress', 'done'].includes(normalizedStatus)) {
        return res.status(400).json({ error: 'Status must be one of: todo, in_progress, done' });
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(normalizedStatus);
    }

    // Validate due date if provided
    if (dueDate !== undefined || due_date !== undefined) {
      const rawDate = dueDate !== undefined ? dueDate : due_date;
      let finalDueDate = null;
      if (rawDate !== null && rawDate !== '') {
        const parsedDate = new Date(rawDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid due date format' });
        }
        finalDueDate = parsedDate;
      }
      updates.push(`due_date = $${paramIndex++}`);
      values.push(finalDueDate);
    }

    // Validate assigned user if provided
    if (assignedUserId !== undefined || assigned_user_id !== undefined) {
      const rawUserId = assignedUserId !== undefined ? assignedUserId : assigned_user_id;
      let finalUserId = null;
      if (rawUserId !== null && rawUserId !== '') {
        const uid = parseId(rawUserId);
        if (!uid) {
          return res.status(400).json({ error: 'assignedUserId must be a valid positive integer' });
        }

        // Verify user exists
        const userCheck = await query('SELECT id FROM users WHERE id = $1', [uid]);
        if (userCheck.rowCount === 0) {
          return res.status(404).json({ error: 'Assigned user does not exist' });
        }

        // Verify user belongs to task's project
        const memberCheck = await query(
          'SELECT id FROM project_users WHERE project_id = $1 AND user_id = $2',
          [currentTask.project_id, uid]
        );
        if (memberCheck.rowCount === 0) {
          return res.status(400).json({ error: 'Assigned user does not belong to this project' });
        }

        finalUserId = uid;
      }
      updates.push(`assigned_user_id = $${paramIndex++}`);
      values.push(finalUserId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    values.push(taskId);
    const updateQuery = `
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, values);
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Internal server error while updating task' });
  }
});

// ==========================================
// 4. DELETE /api/tasks/:taskId
// ==========================================
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const taskId = parseId(req.params.taskId);
    if (!taskId) {
      return res.status(400).json({ error: 'Invalid task ID. Must be a positive integer.' });
    }

    const deleteRes = await query('DELETE FROM tasks WHERE id = $1 RETURNING id', [taskId]);
    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      taskId
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Internal server error while deleting task' });
  }
});

// ==========================================
// 5. POST /api/projects/:projectId/users
// ==========================================
router.post('/projects/:projectId/users', async (req, res) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID. Must be a positive integer.' });
    }

    const { userId, user_id, role = 'member' } = req.body;
    const rawUserId = userId !== undefined ? userId : user_id;

    if (!rawUserId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const targetUserId = parseId(rawUserId);
    if (!targetUserId) {
      return res.status(400).json({ error: 'userId must be a valid positive integer' });
    }

    // Check project exists
    const projectRes = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectRes.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check user exists
    const userRes = await query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for duplicate membership
    const existingMember = await query(
      'SELECT id FROM project_users WHERE project_id = $1 AND user_id = $2',
      [projectId, targetUserId]
    );
    if (existingMember.rowCount > 0) {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }

    const cleanRole = role && typeof role === 'string' ? role.trim() : 'member';

    const insertRes = await query(`
      INSERT INTO project_users (project_id, user_id, role)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [projectId, targetUserId, cleanRole]);

    return res.status(201).json(insertRes.rows[0]);
  } catch (error) {
    console.error('Error adding user to project:', error);
    return res.status(500).json({ error: 'Internal server error while adding user to project' });
  }
});

// ==========================================
// 6. GET /api/projects/:projectId/users
// ==========================================
router.get('/projects/:projectId/users', async (req, res) => {
  try {
    const projectId = parseId(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID. Must be a positive integer.' });
    }

    // Check project exists
    const projectRes = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectRes.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const membersRes = await query(`
      SELECT u.id, u.name, u.email, u.avatar_color, pu.role, u.created_at
      FROM project_users pu
      JOIN users u ON pu.user_id = u.id
      WHERE pu.project_id = $1
      ORDER BY u.name ASC
    `, [projectId]);

    return res.status(200).json(membersRes.rows);
  } catch (error) {
    console.error('Error fetching project users:', error);
    return res.status(500).json({ error: 'Internal server error while fetching project users' });
  }
});

// ==========================================
// Helper GET /api/projects (list projects)
// ==========================================
router.get('/projects', async (req, res) => {
  try {
    const result = await query('SELECT id, name, created_at FROM projects ORDER BY id ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: 'Internal server error while fetching projects' });
  }
});

// ==========================================
// Helper GET /api/users (list all system users)
// ==========================================
router.get('/users', async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, avatar_color FROM users ORDER BY name ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error while fetching users' });
  }
});

export default router;
