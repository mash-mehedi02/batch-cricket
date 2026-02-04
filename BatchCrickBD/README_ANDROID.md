# BatchCrickBD Android Project

This folder contains the native Android project for BatchCrickBD, generated from the web application.

## How to Run

1.  **Open Android Studio**.
2.  Select **File > Open** or "Open an existing Android Studio project".
3.  Navigate to and select this `BatchCrickBD` folder.
4.  Wait for Gradle Sync to complete.
5.  Connect an Android device via USB or start an Emulator.
6.  Click the **Run** button (Green Play Icon).

## How to Update

If you make changes to the web code (in `src`):

1.  Open a terminal in the root project folder (`School-Cricket-Live`).
2.  Run build: `npm run build`
3.  Sync changes:
    *   Note: Since this folder is named `BatchCrickBD` (instead of standard `android`), standard `npx cap sync` might recreate an `android` folder.
    *   To update manually: Copy contents of `dist` to `BatchCrickBD/app/src/main/assets/public`.

## Project Structure

-   `app/src/main/assets/public`: Contains the compiled web app (HTML/JS/CSS).
-   `app/src/main/java`: Native Java/Kotlin code (Main Activity).
-   `app/src/main/res`: Resources (Icons, layouts, XMLs).
