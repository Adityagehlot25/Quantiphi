import React, { useState } from 'react';
import TaskCard from './TaskCard';

/**
 * KanbanColumn represents one of the three workflow states:
 * - todo (To-Do)
 * - in_progress (In Progress)
 * - done (Done)
 *
 * Implements HTML5 drag-over and drop handlers.
 */
export default function KanbanColumn({
  title,
  status,
  tasks = [],
  users = [],
  onTaskDrop,
  onDeleteTask,
  onAssignUser,
  onDragStart,
  onDragEnd,
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    // Only reset if we left the column container itself
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onTaskDrop(taskId, status);
    }
  };

  return (
    <div
      className={`kanban-column column-${status} ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="column-header">
        <div className="column-title-group">
          <span className={`status-indicator indicator-${status}`} />
          <h3 className="column-title">{title}</h3>
        </div>
        <span className="column-count" title={`${tasks.length} tasks`}>
          {tasks.length}
        </span>
      </div>

      <div className="column-content">
        {tasks.length === 0 ? (
          <div className="empty-column-placeholder">
            <span>No tasks in {title.toLowerCase()}</span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              users={users}
              onDelete={onDeleteTask}
              onAssignUser={onAssignUser}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}
