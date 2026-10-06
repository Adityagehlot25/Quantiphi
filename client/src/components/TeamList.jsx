import React, { useState } from 'react';

/**
 * TeamList displays all project members.
 * If user.workloadWarning is true (authoritatively determined by the backend),
 * a pulsing red border/background is applied to the user's avatar.
 * Also supports adding a user to the project.
 */
export default function TeamList({
  users = [],
  workload = [],
  availableUsers = [],
  onAddMember,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState(null);

  // Helper to get initials
  const getInitials = (name = '') => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  // Filter available users who are NOT yet in the project
  const nonMembers = availableUsers.filter(
    (au) => !users.some((u) => u.id === au.id)
  );

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setAddError('Please select a user to add.');
      return;
    }

    setSubmitting(true);
    setAddError(null);
    try {
      if (onAddMember) {
        await onAddMember({
          userId: Number(selectedUserId),
          role: role || 'member',
        });
      }
      setSelectedUserId('');
      setRole('member');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="team-section">
      <div className="team-header">
        <div>
          <h3 className="team-title">Team Members</h3>
          <span className="team-subtitle">
            {users.length} {users.length === 1 ? 'member' : 'members'}
          </span>
        </div>
        {onAddMember && (
          <button
            type="button"
            className="btn-add-member-toggle"
            title="Add user to project"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setAddError(null);
            }}
          >
            {showAddForm ? '✕' : '+ Add'}
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="add-member-inline-form">
          {addError && <div className="inline-form-error">{addError}</div>}
          <div className="inline-form-row">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="inline-select"
              required
            >
              <option value="">Select user...</option>
              {nonMembers.length > 0 ? (
                nonMembers.map((nu) => (
                  <option key={nu.id} value={nu.id}>
                    {nu.name} ({nu.email})
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No non-member users
                </option>
              )}
            </select>
          </div>
          <div className="inline-form-row">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="inline-select"
            >
              <option value="member">Member</option>
              <option value="developer">Developer</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className="btn btn-primary btn-inline-add"
              disabled={submitting || !selectedUserId}
            >
              {submitting ? '...' : 'Add'}
            </button>
          </div>
        </form>
      )}

      <div className="team-list">
        {users.map((user) => {
          const userWorkload = workload.find(
            (w) => w.userId === user.id || w.user_id === user.id
          );
          const inProgressCount = userWorkload
            ? userWorkload.inProgressTaskCount
            : user.inProgressTaskCount || 0;
          const hasWarning = userWorkload
            ? userWorkload.workloadWarning
            : !!user.workloadWarning;

          return (
            <div
              key={user.id}
              className={`team-member-chip ${hasWarning ? 'has-warning' : ''}`}
              title={
                hasWarning
                  ? `BURNOUT WARNING: ${user.name} has ${inProgressCount} In Progress tasks (>5 threshold)!`
                  : `${user.name} (${user.role}) - ${inProgressCount} in progress`
              }
            >
              <div
                className={`user-avatar ${hasWarning ? 'pulsing-warning' : ''}`}
                style={{
                  backgroundColor: user.avatar_color || '#3b82f6',
                }}
              >
                {getInitials(user.name)}
                {hasWarning && (
                  <span className="warning-dot" title="Workload Warning" />
                )}
              </div>

              <div className="member-details">
                <div className="member-name-row">
                  <span className="member-name">{user.name}</span>
                  <span className="member-role">{user.role}</span>
                </div>
                <div className="member-workload-row">
                  <span
                    className={`task-badge ${hasWarning ? 'warning-badge' : ''}`}
                  >
                    {inProgressCount} In Progress
                  </span>
                  {hasWarning && (
                    <span className="burnout-pill">⚠️ Overloaded</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
