-- Drop existing tables if they exist to allow clean recreation
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_users CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_color VARCHAR(50) DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create project_users table (for membership/roles)
CREATE TABLE project_users (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    UNIQUE(project_id, user_id)
);

-- Create tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    status VARCHAR(20) NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update 'updated_at' on tasks
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();


-- SEED DATA

-- Insert users
INSERT INTO users (name, email, avatar_color) VALUES
('Alice Admin', 'alice@example.com', '#FF5733'),
('Bob Builder', 'bob@example.com', '#33FF57'),
('Charlie Coder', 'charlie@example.com', '#3357FF');

-- Insert project
INSERT INTO projects (name) VALUES
('MVP Launch');

-- Assign users to project
INSERT INTO project_users (project_id, user_id, role) VALUES
(1, 1, 'admin'),
(1, 2, 'member'),
(1, 3, 'member');

-- Insert tasks (Bob has 6 in-progress tasks to trigger burnout warning)
INSERT INTO tasks (project_id, assigned_user_id, title, description, priority, status) VALUES
-- Todo tasks
(1, 1, 'Setup CI/CD', 'Configure GitHub Actions for deployment', 'high', 'todo'),
(1, 2, 'Write documentation', 'Update README and API docs', 'low', 'todo'),
(1, 3, 'Design Logo', 'Create SVG logo for app', 'medium', 'todo'),

-- In Progress tasks for Bob (trigger burnout warning > 5)
(1, 2, 'Implement Auth', 'Add JWT authentication', 'high', 'in_progress'),
(1, 2, 'Create user profile page', 'React component for user settings', 'medium', 'in_progress'),
(1, 2, 'Fix drag and drop bug', 'Tasks get stuck on drag', 'high', 'in_progress'),
(1, 2, 'Write unit tests for tasks', 'Use Jest to test task reducer', 'medium', 'in_progress'),
(1, 2, 'Optimize database queries', 'Add indexes to tasks table', 'medium', 'in_progress'),
(1, 2, 'Update dependencies', 'Bump React version', 'low', 'in_progress'),

-- In Progress tasks for Charlie
(1, 3, 'Setup Redux', 'Configure global state management', 'medium', 'in_progress'),

-- Done tasks
(1, 1, 'Initialize Project', 'Create React and Express apps', 'high', 'done'),
(1, 1, 'Database Schema', 'Design minimal postgres schema', 'high', 'done');
