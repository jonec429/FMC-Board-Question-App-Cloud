$csv = Import-Csv -Path "questions.csv"
$sqlFile = "import_questions.sql"
$batchSize = 50
$total = $csv.Count

"DELETE FROM public.questions;" | Out-File -FilePath $sqlFile -Encoding utf8

for ($i = 0; $i -lt $total; $i += $batchSize) {
    $batch = $csv[$i..($i + $batchSize - 1)] | Where-Object { $_ -ne $null }
    
    $values = foreach ($row in $batch) {
        $options = @($row."Opt A", $row."Opt B", $row."Opt C", $row."Opt D", $row."Opt E") | Where-Object { $_ -ne $null -and $_ -ne "" }
        $optionsJson = "[" + (($options | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ",") + "]"
        
        $year = $row.Year -replace "'", "''"
        $cat = $row."ABFM Category" -replace "'", "''"
        $quest = $row.Question -replace "'", "''"
        $correct = [int]$row."Correct Index"
        $expl = $row.Explanation -replace "'", "''"
        $res = $row."Resource Link" -replace "'", "''"
        $area = $row."ABFM Content Area" -replace "'", "''"
        
        "(
            '$year', '$cat', '$cat', '$area', '$quest', $correct, '$expl', '$res', '$optionsJson'::jsonb
        )"
    }
    
    $insert = "INSERT INTO public.questions (year, category, system, abfm_category, question_text, correct_index, explanation, resource_link, options) VALUES " + ($values -join ",") + ";"
    $insert | Out-File -FilePath $sqlFile -Append -Encoding utf8
}

Write-Host "Generated SQL for $total questions in $sqlFile"
