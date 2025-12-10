@echo off
echo ========================================
echo Installing multer while ignoring canvas build errors
echo ========================================
echo.
echo This will install multer and skip canvas build scripts...
echo.

npm install multer --ignore-scripts --legacy-peer-deps

echo.
echo ========================================
echo Checking if multer was installed...
echo ========================================
npm list multer

echo.
echo Done! If you see multer@version above, it's installed successfully.
echo You can now run: nodemon app.js
echo.
pause

