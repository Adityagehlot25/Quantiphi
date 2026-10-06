import { query } from './src/db.js';

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
    throw new Error(`[FAIL] ${message}`);
  }
}

async function runIntegrationTests() {
  console.log('========================================================');
  console.log('   STARTING STEP 5: END-TO-END INTEGRATION TEST SUITE    ');
  console.log('========================================================\n');

  // Test 1: Verify Initial Board Loading
  console.log('Test 1: Initial Board Loading (GET /api/projects/1/board)');
  const initialBoard = await request('/projects/1/board');
  assert(initialBoard.status === 200, `Expected 200, got ${initialBoard.status}`);
  assert(initialBoard.data.project.name === 'MVP Launch', 'Project name must match');
  assert(Array.isArray(initialBoard.data.tasks), 'tasks should be an array');
  assert(Array.isArray(initialBoard.data.users), 'users should be an array');
  assert(Array.isArray(initialBoard.data.workload), 'workload should be an array');

  const initialTodoCount = initialBoard.data.tasks.filter(t => t.status === 'todo').length;
  const initialInProgressCount = initialBoard.data.tasks.filter(t => t.status === 'in_progress').length;
  const initialDoneCount = initialBoard.data.tasks.filter(t => t.status === 'done').length;
  console.log(`✓ Initial Board loaded: Todo=${initialTodoCount}, InProgress=${initialInProgressCount}, Done=${initialDoneCount}`);

  // Check initial workload state (Bob has 6 in-progress tasks -> warning true)
  const bobInitial = initialBoard.data.workload.find(w => w.userName === 'Bob Builder' || w.userId === 2);
  assert(bobInitial && bobInitial.workloadWarning === true, 'Bob Builder must have workloadWarning: true (>5 in progress)');
  console.log(`✓ Initial Workload: Bob Builder has ${bobInitial.inProgressTaskCount} in-progress tasks (workloadWarning: ${bobInitial.workloadWarning})`);

  // Test 2: Task Creation Flow
  console.log('\nTest 2: Task Creation Flow (POST /api/projects/1/tasks)');
  const createRes = await request('/projects/1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Integration Test Task',
      description: 'Created during Step 5 integration verification',
      priority: 'high',
      status: 'todo',
      assignedUserId: 1 // Alice Admin
    })
  });
  assert(createRes.status === 201, `Expected 201, got ${createRes.status}`);
  const createdTaskId = createRes.data.id;
  console.log(`✓ Created task ID: ${createdTaskId} with status: todo, priority: high`);

  // Verify board updates after creation
  const boardAfterCreate = await request('/projects/1/board');
  const todoAfterCreate = boardAfterCreate.data.tasks.filter(t => t.status === 'todo').length;
  assert(todoAfterCreate === initialTodoCount + 1, `Todo count should increment by 1. Was ${initialTodoCount}, now ${todoAfterCreate}`);
  assert(boardAfterCreate.data.tasks.some(t => t.id === createdTaskId), 'New task must exist on refreshed board');
  console.log(`✓ Refreshed Board confirmed: Todo count updated to ${todoAfterCreate}`);

  // Test 3: Drag-and-Drop: Moving task to In Progress (PATCH /api/tasks/:taskId)
  console.log('\nTest 3: Drag & Drop: Move Task to In Progress (PATCH /api/tasks/:taskId)');
  const moveInProgressRes = await request(`/tasks/${createdTaskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'in_progress' })
  });
  assert(moveInProgressRes.status === 200, `Expected 200, got ${moveInProgressRes.status}`);
  assert(moveInProgressRes.data.status === 'in_progress', 'Status must be in_progress');

  // Verify server-side board and Alice's workload
  const boardAfterMove1 = await request('/projects/1/board');
  const inProgressAfterMove1 = boardAfterMove1.data.tasks.filter(t => t.status === 'in_progress').length;
  assert(inProgressAfterMove1 === initialInProgressCount + 1, 'In-progress count must increment');
  const aliceWorkload1 = boardAfterMove1.data.workload.find(w => w.userId === 1);
  assert(aliceWorkload1.inProgressTaskCount === 1, `Alice should have 1 in-progress task, got ${aliceWorkload1.inProgressTaskCount}`);
  console.log(`✓ Task moved to in_progress: InProgress count is now ${inProgressAfterMove1}, Alice has 1 in-progress task`);

  // Test 4: Drag-and-Drop: Moving task to Done
  console.log('\nTest 4: Drag & Drop: Move Task to Done (PATCH /api/tasks/:taskId)');
  const moveDoneRes = await request(`/tasks/${createdTaskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done' })
  });
  assert(moveDoneRes.status === 200, `Expected 200, got ${moveDoneRes.status}`);

  const boardAfterMove2 = await request('/projects/1/board');
  const aliceWorkload2 = boardAfterMove2.data.workload.find(w => w.userId === 1);
  assert(aliceWorkload2.inProgressTaskCount === 0, `Alice in-progress tasks should drop back to 0, got ${aliceWorkload2.inProgressTaskCount}`);
  console.log(`✓ Task moved out of in_progress: Alice in-progress tasks returned to 0`);

  // Test 5: Dynamic Workload Burnout Warning Transition
  console.log('\nTest 5: Workload Burnout Warning Transition');
  // Reassign one of Bob's in-progress tasks to Alice (Bob currently has 6 in progress)
  const bobTask = boardAfterMove2.data.tasks.find(t => t.assigned_user_id === 2 && t.status === 'in_progress');
  assert(bobTask, 'Bob must have an in-progress task to reassign');

  console.log(`- Reassigning Bob's task (ID ${bobTask.id}) to Alice...`);
  const reassignRes = await request(`/tasks/${bobTask.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedUserId: 1 })
  });
  assert(reassignRes.status === 200, `Expected 200, got ${reassignRes.status}`);

  // Fetch board to verify Bob's burnout warning is now CLEARED (count drops to 5, threshold is > 5)
  const boardAfterReassign = await request('/projects/1/board');
  const bobAfterReassign = boardAfterReassign.data.workload.find(w => w.userId === 2);
  assert(bobAfterReassign.inProgressTaskCount === 5, `Bob in-progress tasks should be 5, got ${bobAfterReassign.inProgressTaskCount}`);
  assert(bobAfterReassign.workloadWarning === false, `Bob workloadWarning should be false when count <= 5, got ${bobAfterReassign.workloadWarning}`);
  console.log(`✓ When in-progress tasks drop to 5, Bob's warning correctly CLEARS (count: 5, warning: false)`);

  // Reassign it back to Bob to verify warning turns BACK ON (> 5)
  console.log(`- Reassigning task back to Bob...`);
  await request(`/tasks/${bobTask.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedUserId: 2 })
  });
  const boardAfterRestore = await request('/projects/1/board');
  const bobRestored = boardAfterRestore.data.workload.find(w => w.userId === 2);
  assert(bobRestored.inProgressTaskCount === 6, 'Bob should have 6 in-progress tasks again');
  assert(bobRestored.workloadWarning === true, 'Bob workloadWarning must be true again');
  console.log(`✓ When in-progress tasks increase back to 6, Bob's warning correctly RE-ACTIVATES (count: 6, warning: true)`);

  // Test 6: Task Deletion
  console.log('\nTest 6: Task Deletion (DELETE /api/tasks/:taskId)');
  const deleteRes = await request(`/tasks/${createdTaskId}`, { method: 'DELETE' });
  assert(deleteRes.status === 200, `Expected 200, got ${deleteRes.status}`);

  const boardAfterDelete = await request('/projects/1/board');
  assert(!boardAfterDelete.data.tasks.some(t => t.id === createdTaskId), 'Deleted task must not appear in board');
  console.log(`✓ Deleted task ID ${createdTaskId} verified absent from board`);

  // Test 7: Priority Filtering
  console.log('\nTest 7: Server-side Priority Filtering');
  const highOnly = await request('/projects/1/board?priority=high');
  assert(highOnly.status === 200, `Expected 200, got ${highOnly.status}`);
  assert(highOnly.data.tasks.every(t => t.priority === 'high'), 'All tasks in response must have priority high');
  console.log(`✓ Priority filter high returned ${highOnly.data.tasks.length} high priority tasks`);

  const lowOnly = await request('/projects/1/board?priority=low');
  assert(lowOnly.status === 200, `Expected 200, got ${lowOnly.status}`);
  assert(lowOnly.data.tasks.every(t => t.priority === 'low'), 'All tasks in response must have priority low');
  console.log(`✓ Priority filter low returned ${lowOnly.data.tasks.length} low priority tasks`);

  // Test 8: Error Handling and Resilience
  console.log('\nTest 8: Error Handling & Resilience');
  // Attempt invalid update
  const badUpdate = await request('/tasks/99999', { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
  assert(badUpdate.status === 404, `Expected 404 for non-existent task, got ${badUpdate.status}`);

  const badPriority = await request('/projects/1/board?priority=critical');
  assert(badPriority.status === 400, `Expected 400 for invalid priority, got ${badPriority.status}`);

  console.log('✓ Invalid calls return proper HTTP status codes without crashing');

  console.log('\n========================================================');
  console.log('   ALL STEP 5 INTEGRATION TESTS PASSED SUCCESSFULLY!    ');
  console.log('========================================================\n');

  process.exit(0);
}

runIntegrationTests().catch(err => {
  console.error('\n❌ Integration tests failed:', err);
  process.exit(1);
});
