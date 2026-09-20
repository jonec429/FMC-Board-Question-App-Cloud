$csv = Import-Csv -Path "roster.csv"
$sqlFile = "import_roster.sql"

"-- Roster Import" | Out-File -FilePath $sqlFile -Encoding utf8

$values = foreach ($row in $csv) {
    $name = $row."Resident Name" -replace "'", "''"
    $email = $row.Email.ToLower() -replace "'", "''"
    $pgy = $row."Class Of (PGY)" -replace "'", "''"
    $advisor = $row."Faculty Advisor" -replace "'", "''"
    
    # We can't insert ID because we don't have Auth IDs yet.
    # We will use this table as a lookup for registration.
    # For now, let's just make sure the profiles table has these emails pre-filled.
    
    "('$name', '$email', '$pgy', '$advisor')"
}

# Note: This is for a temporary 'authorized_roster' table to control sign-ups
"CREATE TABLE IF NOT EXISTS public.authorized_roster (name TEXT, email TEXT PRIMARY KEY, pgy TEXT, advisor TEXT);" | Out-File -FilePath $sqlFile -Append -Encoding utf8
"DELETE FROM public.authorized_roster;" | Out-File -FilePath $sqlFile -Append -Encoding utf8
"INSERT INTO public.authorized_roster (name, email, pgy, advisor) VALUES " + ($values -join ",") + ";" | Out-File -FilePath $sqlFile -Append -Encoding utf8
