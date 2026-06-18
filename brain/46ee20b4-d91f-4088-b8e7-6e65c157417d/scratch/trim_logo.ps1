Add-Type -AssemblyName System.Drawing

$inputPath = "c:\Users\HP\Documents\Pdf-project\src\assets\logo.png"
$outputPath = "c:\Users\HP\Documents\Pdf-project\src\assets\logo_trimmed.png"

$bmp = New-Object System.Drawing.Bitmap($inputPath)
$width = $bmp.Width
$height = $bmp.Height

# Get the background color from top-left corner
$bgColor = $bmp.GetPixel(0, 0)
Write-Output "Background color at (0,0): R=$($bgColor.R), G=$($bgColor.G), B=$($bgColor.B)"

# Threshold for color difference
$threshold = 8

function IsBackground($color, $bg) {
    [Math]::Abs($color.R - $bg.R) -lt $threshold -and
    [Math]::Abs($color.G - $bg.G) -lt $threshold -and
    [Math]::Abs($color.B - $bg.B) -lt $threshold
}

$minX = $width
$maxX = 0
$minY = $height
$maxY = 0

# Find bounding box of non-background pixels
for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if (-not (IsBackground $c $bgColor)) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Bounding Box: MinX=$minX, MaxX=$maxX, MinY=$minY, MaxY=$maxY"

if ($minX -lt $maxX -and $minY -lt $maxY) {
    # Add a tiny margin around the cropped area
    $margin = 4
    $cropX = [Math]::Max(0, $minX - $margin)
    $cropY = [Math]::Max(0, $minY - $margin)
    $cropW = [Math]::Min($width - $cropX, ($maxX - $minX) + 2 * $margin)
    $cropH = [Math]::Min($height - $cropY, ($maxY - $minY) + 2 * $margin)

    Write-Output "Cropping to X=$cropX, Y=$cropY, W=$cropW, H=$cropH"

    # Create cropped bitmap
    $cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $croppedBmp = $bmp.Clone($cropRect, $bmp.PixelFormat)
    
    # Save trimmed image
    $croppedBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $croppedBmp.Dispose()
    Write-Output "Trimmed image saved to $outputPath"
} else {
    Write-Output "Error: No bounding box found!"
}

$bmp.Dispose()
