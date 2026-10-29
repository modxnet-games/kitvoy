# Deploy madilik to VPS
# Run from store folder: .\scripts\deploy-vps.ps1
# Set MADILIK_VPS_HOST first; enter the root password when prompted.

$VPS = "root@$env:MADILIK_VPS_HOST"
$REMOTE_CMD = "cd /var/www/madilik && git pull origin main && npm install && npm run build && pm2 restart madilik --update-env && pm2 status madilik"

Write-Host "Deploying to VPS - Enter password when prompted" -ForegroundColor Cyan
& ssh -o StrictHostKeyChecking=no $VPS $REMOTE_CMD
