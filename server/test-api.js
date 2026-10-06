const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, ok: res.ok, data };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('--- Starting API Verification Suite ---');

  // 1. Health check
  console.log('\n[1] Testing GET /health');
  const healthRes = await request('/health');
  assert(healthRes.status === 200, `Expected 200, got ${healthRes.status}`);
  assert(healthRes.data.status === 'ok', 'Health status should be ok');
  console.log('✓ Health check passed');

  // 2. Board retrieval
  console.log('\n[2] Testing GET /projects/1/board');
  const boardRes = await request('/projects/1/board');
  assert(boardRes.status === 200, `Expected 200, got ${boardRes.status}`);
  assert(boardRes.data.project.id === 1, 'Project id should be 1');
  assert(Array.isArray(boardRes.data.tasks), 'tasks should be an array');
  assert(Array.isArray(boardRes.data.users), 'users should be an array');
  assert(Array.isArray(boardRes.data.workload), 'workload should be an array');
  console.log(`✓ Board retrieved: ${boardRes.data.tasks.length} tasks, ${boardRes.data.users.length} members`);

  // 3. Workload calculation
  console.log('\n[3] Testing Workload calculation');
  const bobWorkload = boardRes.data.workload.find(w => w.userName === 'Bob Builder' || w.userId === 2);
  assert(bobWorkload, 'Bob Builder workload entry must exist');
  assert(bobWorkload.inProgressTaskCount === 6, `Bob should have 6 in-progress tasks, got ${bobWorkload.inProgressTaskCount}`);
  assert(bobWorkload.workloadWarning === true, 'Bob should have workloadWarning = true (> 5 in progress)');

  const aliceWorkload = boardRes.data.workload.find(w => w.userName === 'Alice Admin' || w.userId === 1);
  assert(aliceWorkload, 'Alice Admin workload entry must exist');
  assert(aliceWorkload.inProgressTaskCount === 0, `Alice should have 0 in-progress tasks, got ${aliceWorkload.inProgressTaskCount}`);
  assert(aliceWorkload.workloadWarning === false, 'Alice should have workloadWarning = false');
  console.log(`✓ Workload verified: Bob (count: ${bobWorkload.inProgressTaskCount}, warning: ${bobWorkload.workloadWarning}), Alice (count: ${aliceWorkload.inProgressTaskCount}, warning: ${aliceWorkload.workloadWarning})`);

  // 4. Priority filtering
  console.log('\n[4] Testing GET /projects/1/board?priority=high');
  const highRes = await request('/projects/1/board?priority=high');
  assert(highRes.status === 200, `Expected 200, got ${highRes.status}`);
  assert(highRes.data.tasks.every(t => t.priority === 'high'), 'All returned tasks must have priority high');
  console.log(`✓ Priority filter high returned ${highRes.data.tasks.length} tasks, all verified priority: high`);

  console.log('\n[4b] Testing GET /projects/1/board?priority=invalid');
  const invalidPriorityRes = await request('/projects/1/board?priority=urgent');
  assert(invalidPriorityRes.status === 400, `Expected 400, got ${invalidPriorityRes.status}`);
  console.log('✓ Invalid priority filter returned 400');

  // 5. Get project users
  console.log('\n[5] Testing GET /projects/1/users');
  const usersRes = await request('/projects/1/users');
  assert(usersRes.status === 200, `Expected 200, got ${usersRes.status}`);
  assert(usersRes.data.length >= 3, 'Should have at least 3 project users');
  console.log(`✓ Project users retrieved: ${usersRes.data.length} users`);

  // 6. Task creation
  console.log('\n[6] Testing POST /projects/1/tasks');
  const newTaskRes = await request('/projects/1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Automated Test Task',
      description: 'Testing task creation endpoint',
      priority: 'high',
      status: 'todo',
      assignedUserId: 1
    })
  });
  assert(newTaskRes.status === 201, `Expected 201, got ${newTaskRes.status}`);
  assert(newTaskRes.data.title === 'Automated Test Task', 'Task title must match');
  assert(newTaskRes.data.priority === 'high', 'Task priority must match');
  assert(newTaskRes.data.status === 'todo', 'Task status must match');
  assert(newTaskRes.data.assigned_user_id === 1, 'Task assigned user must match');
  const createdTaskId = newTaskRes.data.id;
  console.log(`✓ Created task id ${createdTaskId}`);

  // 7. Task update (PATCH /tasks/:taskId)
  console.log('\n[7] Testing PATCH /tasks/:taskId (status & content update)');
  const updateRes = await request(`/tasks/${createdTaskId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Updated Test Task Title',
      status: 'in_progress',
      priority: 'medium'
    })
  });
  assert(updateRes.status === 200, `Expected 200, got ${updateRes.status}`);
  assert(updateRes.data.title === 'Updated Test Task Title', 'Updated title should match');
  assert(updateRes.data.status === 'in_progress', 'Updated status should be in_progress');
  assert(updateRes.data.priority === 'medium', 'Updated priority should be medium');
  console.log(`✓ Task ${createdTaskId} updated successfully`);

  // 8. Task deletion (DELETE /tasks/:taskId)
  console.log('\n[8] Testing DELETE /tasks/:taskId');
  const deleteRes = await request(`/tasks/${createdTaskId}`, {
    method: 'DELETE'
  });
  assert(deleteRes.status === 200, `Expected 200, got ${deleteRes.status}`);
  assert(deleteRes.data.success === true, 'Expected success: true');

  // Verify deletion with 404
  const getDeletedRes = await request(`/tasks/${createdTaskId}`, { method: 'PATCH', body: JSON.stringify({ title: 'New' }) });
  assert(getDeletedRes.status === 404, `Expected 404 after deletion, got ${getDeletedRes.status}`);
  console.log(`✓ Task ${createdTaskId} deleted and verified gone`);

  // 9. Adding project user and duplicate handling
  console.log('\n[9] Testing POST /projects/1/users (Duplicate membership)');
  const dupUserRes = await request('/projects/1/users', {
    method: 'POST',
    body: JSON.stringify({ userId: 1, role: 'member' })
  });
  assert(dupUserRes.status === 409, `Expected 409 for duplicate member, got ${dupUserRes.status}`);
  console.log('✓ Duplicate member addition properly rejected with 409 Conflict');

  console.log('\n[9b] Testing POST /projects/1/users (Successful user addition)');
  // Create a new user directly in DB for testing project addition
  const { query } = await import('./src/db.js');
  await query("DELETE FROM users WHERE email = 'test_member@example.com'");
  const tempUser = await query(
    "INSERT INTO users (name, email, avatar_color) VALUES ('Test Member', 'test_member@example.com', '#999999') RETURNING id"
  );
  const tempUserId = tempUser.rows[0].id;

  const addUserRes = await request('/projects/1/users', {
    method: 'POST',
    body: JSON.stringify({ userId: tempUserId, role: 'contributor' })
  });
  assert(addUserRes.status === 201, `Expected 201, got ${addUserRes.status}`);
  assert(addUserRes.data.role === 'contributor', 'Role should match contributor');
  console.log(`✓ Added user ${tempUserId} to project 1`);

  // Verify user appears in project users
  const updatedUsersRes = await request('/projects/1/users');
  assert(updatedUsersRes.data.some(u => u.id === tempUserId), 'New user must appear in project users list');
  console.log('✓ New user verified in project members list');

  // Clean up test user
  await query('DELETE FROM users WHERE id = $1', [tempUserId]);
  console.log('✓ Cleaned up test user');

  // 10. Invalid input handling
  console.log('\n[10] Testing Invalid input handling');
  // Missing title
  const noTitleRes = await request('/projects/1/tasks', {
    method: 'POST',
    body: JSON.stringify({ priority: 'low' })
  });
  assert(noTitleRes.status === 400, `Expected 400 for missing title, got ${noTitleRes.status}`);

  // Invalid status
  const invalidStatusRes = await request('/projects/1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Invalid Status Task', status: 'unknown_status' })
  });
  assert(invalidStatusRes.status === 400, `Expected 400 for invalid status, got ${invalidStatusRes.status}`);

  // Non-existent project
  const nonExistentProjRes = await request('/projects/9999/board');
  assert(nonExistentProjRes.status === 404, `Expected 404 for missing project, got ${nonExistentProjRes.status}`);

  // Assign user not belonging to project
  const unassignedUserRes = await request('/projects/1/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Bad User Task', assignedUserId: 9999 })
  });
  assert(unassignedUserRes.status === 404 || unassignedUserRes.status === 400, `Expected 400/404 for non-existent user, got ${unassignedUserRes.status}`);

  console.log('✓ All invalid input cases returned appropriate error status codes');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
