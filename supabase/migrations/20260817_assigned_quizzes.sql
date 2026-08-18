-- Create assigned_quizzes table for Faculty-Assigned Quizzes

CREATE TABLE IF NOT EXISTS assigned_quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    question_ids JSONB NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE assigned_quizzes ENABLE ROW LEVEL SECURITY;

-- Policies for assigned_quizzes

-- Residents can read their own assigned quizzes
CREATE POLICY "Residents can view their own assigned quizzes" ON assigned_quizzes
    FOR SELECT
    USING (auth.uid() = assigned_to);

-- Admins and Faculty can view all assigned quizzes
CREATE POLICY "Admins and Faculty can view all assigned quizzes" ON assigned_quizzes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'faculty')
        )
    );

-- Admins and Faculty can insert assigned quizzes
CREATE POLICY "Admins and Faculty can assign quizzes" ON assigned_quizzes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'faculty')
        )
    );

-- Admins and Faculty can update assigned quizzes
CREATE POLICY "Admins and Faculty can update assigned quizzes" ON assigned_quizzes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'faculty')
        )
    );

-- Admins and Faculty can delete assigned quizzes
CREATE POLICY "Admins and Faculty can delete assigned quizzes" ON assigned_quizzes
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'faculty')
        )
    );

-- Residents can update their own assigned quizzes (e.g., mark as completed)
CREATE POLICY "Residents can update their own assigned quizzes" ON assigned_quizzes
    FOR UPDATE
    USING (auth.uid() = assigned_to);
