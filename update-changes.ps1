# Update Dashboard.tsx - Add shimmer to main progress bar
$content = Get-Content "src/components/Dashboard.tsx" -Raw
$content = $content -replace 'className="h-2 rounded-full transition-all duration-500 relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-blue-500"', 'className="h-2 rounded-full transition-all duration-500 relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-blue-500 progress-shimmer"'
Set-Content "src/components/Dashboard.tsx" $content

# Update Dashboard.tsx - Fix Finish Race button logic
$content = Get-Content "src/components/Dashboard.tsx" -Raw
$content = $content -replace '{nextRunner\.id === 36 && canEdit && \(', '{nextRunner.id === 36 && canEdit && nextRunner.actualStart && !nextRunner.actualFinish && ('
Set-Content "src/components/Dashboard.tsx" $content

# Update Dashboard.tsx - Fix footer view only code
$content = Get-Content "src/components/Dashboard.tsx" -Raw
$content = $content -replace '<CopyIcon className="h-4 w-4 mr-0\.5" />', '<Eye className="h-4 w-4 mr-0.5" />'
Set-Content "src/components/Dashboard.tsx" $content

# Update TeamSettings.tsx - Change button text
$content = Get-Content "src/components/TeamSettings.tsx" -Raw
$content = $content -replace 'Share Invite Link', 'Share Invite Token'
Set-Content "src/components/TeamSettings.tsx" $content

# Update TeamSettings.tsx - Reduce header padding
$content = Get-Content "src/components/TeamSettings.tsx" -Raw
$content = $content -replace 'px-4 py-6', 'px-4 py-4'
Set-Content "src/components/TeamSettings.tsx" $content

# Update SetupWizard.tsx - Center the text and input
$content = Get-Content "src/components/SetupWizard.tsx" -Raw
$content = $content -replace '<Label>When does your wave start\?</Label>', '<div className="text-center"><Label>When does your wave start?</Label></div>'
$content = $content -replace '<LocalizationProvider dateAdapter={AdapterDayjs}>', '<div className="flex justify-center"><LocalizationProvider dateAdapter={AdapterDayjs}>'
$content = $content -replace '</LocalizationProvider>', '</LocalizationProvider></div>'
Set-Content "src/components/SetupWizard.tsx" $content

# Update RunnerAssignmentModal.tsx - Remove remaining text
$content = Get-Content "src/components/RunnerAssignmentModal.tsx" -Raw
$content = $content -replace 'Click legs to toggle selection\. Your selection is preserved across vans\.', 'Click legs to toggle selection.'
Set-Content "src/components/RunnerAssignmentModal.tsx" $content

Write-Host "All changes applied successfully!"
