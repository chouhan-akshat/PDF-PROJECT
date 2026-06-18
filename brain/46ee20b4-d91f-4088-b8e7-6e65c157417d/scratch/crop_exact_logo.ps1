Add-Type -AssemblyName System.Drawing

$inputPath = "c:\Users\HP\Documents\Pdf-project\src\assets\logo.png"
$outputPath = "c:\Users\HP\Documents\Pdf-project\src\assets\logo_exact_cropped.png"

$bmp = New-Object System.Drawing.Bitmap($inputPath)
$width = $bmp.Width
$height = $bmp.Height

function IsLogoElement($color) {
    # Calculate difference between max and min color channels (saturation indicator)
    $max = [Math]::Max($color.R, [Math]::Max($color.G, $color.B))
    $min = [Math]::Min($color.R, [Math]::Min($color.G, $color.B))
    $diff = $max - $min

    # EITHER: Highly saturated color (blue square, yellow hand, blue text)
    if ($diff -gt 30) {
        return $true
    }

    # OR: Very dark pixel (the dark text "Hey")
    $avg = ($color.R + $color.G + $color.B) / 3
    if ($avg -lt 120) {
        return $true
    }

    return $false
}

$minX = $width
$maxX = 0
$minY = $height
$maxY = 0

# Scan image
for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if (IsLogoElement $c) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Exact logo elements Bounding Box: MinX=$minX, MaxX=$maxX, MinY=$minY, MaxY=$maxY"

if ($minX -lt $maxX -and $minY -lt $maxY) {
    # Add a comfortable margin around the logo elements (e.g. 16 pixels)
    $margin = 16
    $cropX = [Math]::Max(0, $minX - $margin)
    $cropY = [Math]::Max(0, $minY - $margin)
    $cropW = [Math]::Min($width - $cropX, ($maxX - $minX) + 2 * $margin)
    $cropH = [Math]::Min($height - $cropY, ($maxY - $minY) + 2 * $margin)

    Write-Output "Cropping to X=$cropX, Y=$cropY, W=$cropW, H=$cropH"

    # Create cropped bitmap
    $cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $croppedBmp = $bmp.Clone($cropRect, $bmp.PixelFormat)
    
    # Save cropped image
    $croppedBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $croppedBmp.Dispose()
    Write-Output "Exact logo elements saved to $outputPath"
} else {
    Write-Output "Error: No logo elements bounding box found!"
}

$bmp.Dispose()
