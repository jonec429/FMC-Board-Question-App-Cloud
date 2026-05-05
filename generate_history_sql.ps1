$resultsFile = "c:\Users\jcarb\.gemini\antigravity\scratch\FMC QBank Cloud\results.csv"
$attendanceFile = "c:\Users\jcarb\.gemini\antigravity\scratch\FMC QBank Cloud\attendance.csv"
$blocksFile = "c:\Users\jcarb\.gemini\antigravity\scratch\FMC QBank Cloud\Quiz_Master_List.csv"
$outputFile = "c:\Users\jcarb\.gemini\antigravity\scratch\FMC QBank Cloud\import_history.sql"

$sql = "BEGIN;`n"

# 1. Align Tables
$sql += "CREATE TABLE IF NOT EXISTS public.blocks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, tab_name TEXT, last_updated DATE);`n"
$sql += "ALTER TABLE public.results ALTER COLUMN user_id DROP NOT NULL;`n"
$sql += "ALTER TABLE public.results ADD COLUMN IF NOT EXISTS category_stats JSONB DEFAULT '{}';`n"
$sql += "ALTER TABLE public.results ADD COLUMN IF NOT EXISTS legacy_email TEXT;`n"

# Adjust Attendance table to handle history
$sql += "ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS resident_email TEXT;`n"
$sql += "ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS resident_name TEXT;`n"
$sql += "ALTER TABLE public.attendance ALTER COLUMN user_id DROP NOT NULL;`n"

# 2. Blocks
$blocks = Import-Csv $blocksFile
foreach ($row in $blocks) {
    $id = $row.'Quiz ID'.Replace("'", "''")
    $title = $row.Title.Replace("'", "''")
    $desc = $row.Description.Replace("'", "''")
    $tab = $row.'Tab Name'.Replace("'", "''")
    $updated = $row.'Last Updated'
    
    $sql += "INSERT INTO public.blocks (id, title, description, tab_name, last_updated) VALUES ('$id', '$title', '$desc', '$tab', '$updated') ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;`n"
}

# 3. Results
$results = Import-Csv $resultsFile
foreach ($row in $results) {
    $ts = $row.Timestamp
    $email = $row.Email.Replace("'", "''")
    $topic = $row.Topic.Replace("'", "''")
    $correct = $row.Correct
    $total = $row.Total
    $scoreStr = $row.Score.Replace("%", "")
    $score = [double]$scoreStr
    $points = $row.'Academic Points'
    $stats = $row.'Category Stats'.Replace("'", "''")
    if ([string]::IsNullOrWhitespace($stats)) { $stats = "{}" }

    $sql += "INSERT INTO public.results (topic, score, total, percentage, academic_points, legacy_email, category_stats, created_at) VALUES ('$topic', $correct, $total, $score, $points, '$email', '$stats', '$ts');`n"
}

# 4. Attendance (Mapping to your columns: resident_email, resident_name, date, points)
$attendance = Import-Csv $attendanceFile
foreach ($row in $attendance) {
    $email = $row.Email.Replace("'", "''")
    $name = $row.Resident.Replace("'", "''")
    $date = $row.'Conference Date'
    $topic = $row.Topic.Replace("'", "''")
    $status = $row.Status.Replace("'", "''")
    $points = $row.'Academic Points'
    
    $sql += "INSERT INTO public.attendance (resident_email, resident_name, date, topic, status, points) VALUES ('$email', '$name', '$date', '$topic', '$status', $points);`n"
}

$sql += "COMMIT;`n"

$sql | Out-File -FilePath $outputFile -Encoding utf8
Write-Host "THE FINAL SQL generated: $outputFile"
