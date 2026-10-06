import React from 'react';

/**
 * TaskCard renders an individual task item.
 * Supports HTML5 drag-and-drop, quick user assignment, and task deletion.
 */
export default function TaskCard({
  task,
  users = [],
  onDelete,
  onAssignUser,
  onDragStart,
  onDragEnd,
}) {
  const assignedUser = users.find((u) => u.id === task.assigned_user_id);

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formattedDueDate = formatDate(task.due_date);

  const getInitials = (name = '') => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const handleAssignChange = (e) => {
    e.stopPropagation();
    const newUserId = e.target.value ? Number(e.target.value) : null;
    if (onAssignUser) {
      onAssignUser(task.id, newUserId);
    }
  };

  return (
    <div
      className={`task-card priority-${task.priority}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
    >
      <div className="task-card-header">
        <span className={`priority-tag tag-${task.priority}`}>
          {task.priority.toUpperCase()}
        </span>
        <button
          className="delete-task-btn"
          title="Delete task"
          aria-label="Delete task"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
        >
          ×
        </button>
      </div>

      <h4 className="task-card-title">{task.title}</h4>

      {task.description && (
        <p className="task-card-desc">{task.description}</p>
      )}

      <div className="task-card-footer">
        {formattedDueDate ? (
          <span className="due-date-badge" title={`Due: ${task.due_date}`}>
            📅 {formattedDueDate}
          </span>
        ) : (
          <span className="no-date-badge">No due date</span>
        )}

        <div className="assignee-control" onClick={(e) => e.stopPropagation()}>
          {assignedUser && (
            <div
              className={`small-avatar ${assignedUser.workloadWarning ? 'pulsing-warning' : ''}`}
              style={{ backgroundColor: assignedUser.avatar_color || '#3b82f6' }}
              title={`${assignedUser.name}${assignedUser.workloadWarning ? ' (Overloaded!)' : ''}`}
            >
              {getInitials(assignedUser.name)}
            </div>
          )}

          <select
            className={`card-assignee-select ${assignedUser?.workloadWarning ? 'select-warning' : ''}`}
            value={task.assigned_user_id || ''}
            onChange={handleAssignChange}
            title="Change assigned team member"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.workloadWarning ? '⚠️' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
