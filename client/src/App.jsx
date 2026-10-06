import { useState, useEffect, useCallback } from 'react';
import {
  getBoard,
  createTask,
  updateTask,
  deleteTask,
  getAllUsers,
  addProjectUser,
} from './api';
import KanbanColumn from './components/KanbanColumn';
import TeamList from './components/TeamList';
import TaskModal from './components/TaskModal';
import './App.css';

export default function App() {
  const [projectId] = useState(1);
  const [boardData, setBoardData] = useState({
    project: null,
    tasks: [],
    users: [],
    workload: [],
  });
  const [allUsers, setAllUsers] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  // Fetch board data from server with current priority filter
  const fetchBoard = useCallback(async (filter = priorityFilter) => {
    setLoading(true);
    try {
      const data = await getBoard(projectId, filter === 'all' ? '' : filter);
      setBoardData(data);
    } catch (err) {
      console.error('Failed to load board data:', err);
      setError(err.message || 'Unable to connect to backend server');
    } finally {
      setLoading(false);
    }
  }, [projectId, priorityFilter]);

  // Initial load and filter change
  useEffect(() => {
    fetchBoard(priorityFilter);
    getAllUsers().then(setAllUsers).catch(() => {});
  }, [priorityFilter, fetchBoard]);

  // Handle adding member to project
  const handleAddMember = async (payload) => {
    try {
      await addProjectUser(projectId, payload);
      await fetchBoard();
      const updatedUsers = await getAllUsers();
      setAllUsers(updatedUsers);
    } catch (err) {
      console.error('Failed to add project member:', err);
      setError(`Failed to add team member: ${err.message}`);
      throw err;
    }
  };

  // Handle filter selection
  const handleFilterChange = (newFilter) => {
    setPriorityFilter(newFilter);
  };

  // Drag start
  const handleDragStart = (e, task) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  // Drag end
  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  // Handle drop on a column (drag-and-drop movement)
  const handleTaskDrop = async (taskIdStr, destinationStatus) => {
    const taskId = Number(taskIdStr);
    const task = boardData.tasks.find((t) => t.id === taskId);

    if (!task) return;
    if (task.status === destinationStatus) return; // No change needed

    try {
      // Authoritatively update on the server
      await updateTask(taskId, { status: destinationStatus });
      // Re-fetch board to get updated task list and re-calculated workload warnings
      await fetchBoard();
    } catch (err) {
      console.error('Failed to update task status:', err);
      setError(`Failed to move task: ${err.message}`);
      // Ensure UI stays in sync with server state
      await fetchBoard();
    }
  };

  // Assign or reassign a task
  const handleAssignUser = async (taskId, assignedUserId) => {
    try {
      await updateTask(taskId, { assignedUserId });
      await fetchBoard();
    } catch (err) {
      console.error('Failed to update assignee:', err);
      setError(`Failed to assign user: ${err.message}`);
      await fetchBoard();
    }
  };

  // Create task
  const handleCreateTask = async (taskPayload) => {
    try {
      await createTask(projectId, taskPayload);
      await fetchBoard();
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(`Failed to create task: ${err.message}`);
      throw err;
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask(taskId);
      await fetchBoard();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError(`Failed to delete task: ${err.message}`);
      await fetchBoard();
    }
  };

  // Filter tasks into the 3 columns
  const todoTasks = boardData.tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = boardData.tasks.filter((t) => t.status === 'in_progress');
  const doneTasks = boardData.tasks.filter((t) => t.status === 'done');

  // Check if any team member has a burnout warning
  const overloadedUsers = boardData.users.filter((u) => u.workloadWarning);

  return (
    <div className="kanban-app">
      {/* Top Navigation / Header */}
      <header className="app-topbar">
        <div className="topbar-left">
          <div className="app-logo-badge">📋</div>
          <div>
            <h1 className="app-heading">Kanban Board</h1>
            <div className="project-subtext">
              Project: <span className="project-name-highlight">{boardData.project?.name || 'Loading...'}</span>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          {/* Priority Filter */}
          <div className="filter-group">
            <span className="filter-label">Priority:</span>
            <div className="filter-buttons">
              {['all', 'low', 'medium', 'high'].map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  className={`filter-btn ${priorityFilter === filterKey ? 'active' : ''}`}
                  onClick={() => handleFilterChange(filterKey)}
                >
                  {filterKey.charAt(0).toUpperCase() + filterKey.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* New Task Button */}
          <button
            type="button"
            className="btn btn-primary new-task-btn"
            onClick={() => setIsModalOpen(true)}
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Burnout Alert Banner (if any team member is overloaded) */}
      {overloadedUsers.length > 0 && (
        <div className="burnout-banner">
          <span className="banner-icon">⚠️</span>
          <div className="banner-text">
            <strong>Workload Alert:</strong>{' '}
            {overloadedUsers.map((u) => u.name).join(', ')} has more than 5 tasks In Progress! Avatar is pulsing red.
          </div>
        </div>
      )}

      {/* Error Banner with dismiss and retry */}
      {error && (
        <div className="global-error-banner">
          <span>⚠️ {error}</span>
          <div className="error-actions">
            <button className="error-dismiss-btn" onClick={() => fetchBoard()}>
              Retry
            </button>
            <button className="error-dismiss-btn" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="main-layout">
        {/* Team Members List */}
        <aside className="team-sidebar">
          <TeamList
            users={boardData.users}
            workload={boardData.workload}
            availableUsers={allUsers}
            onAddMember={handleAddMember}
          />
        </aside>

        {/* Board Columns Area */}
        <main className="board-area">
          {loading && boardData.tasks.length === 0 ? (
            <div className="board-loading-state">
              <div className="spinner" />
              <p>Loading board tasks...</p>
            </div>
          ) : (
            <div className="columns-grid">
              <KanbanColumn
                title="To-Do"
                status="todo"
                tasks={todoTasks}
                users={boardData.users}
                onTaskDrop={handleTaskDrop}
                onDeleteTask={handleDeleteTask}
                onAssignUser={handleAssignUser}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />

              <KanbanColumn
                title="In Progress"
                status="in_progress"
                tasks={inProgressTasks}
                users={boardData.users}
                onTaskDrop={handleTaskDrop}
                onDeleteTask={handleDeleteTask}
                onAssignUser={handleAssignUser}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />

              <KanbanColumn
                title="Done"
                status="done"
                tasks={doneTasks}
                users={boardData.users}
                onTaskDrop={handleTaskDrop}
                onDeleteTask={handleDeleteTask}
                onAssignUser={handleAssignUser}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            </div>
          )}
        </main>
      </div>

      {/* Create Task Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
        users={boardData.users}
      />
    </div>
  );
}
