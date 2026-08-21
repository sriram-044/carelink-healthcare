# MediLink AI — Android Health Connect Prototype

> **MediLink AI** is an Android healthcare application built with **Kotlin** and **Jetpack Compose** that connects directly to **Android Health Connect** to securely read and display a patient's vital health metrics (**Heart Rate** and **Step Count**).

---

## 📋 1. Project Overview

MediLink AI establishes the primary baseline pipeline for reading patient vitals directly from Android's central health data framework, **Health Connect**.

### Exact Prototype Data Scope:
- **Health Connect Connection**: Availability checking, client initialization, permission contract handling.
- **❤️ Heart Rate**: Querying latest `HeartRateRecord` samples (BPM and formatted timestamp).
- **🚶 Steps**: Querying today's aggregated step count using `StepsRecord.COUNT_TOTAL`.
- **Data Integrity**: **No fake, dummy, or hardcoded values**. If no data exists in Health Connect, explicit empty states are displayed ("No heart-rate data available", "No step data available").

---

## 🛠️ 2. Requirements

- **Operating System**: Windows, macOS, or Linux
- **IDE**: Android Studio Jellyfish / Koala or newer
- **Language**: Kotlin 2.0+
- **UI Framework**: Jetpack Compose (Material3)
- **Minimum Android Version**: Android 9.0 (API Level 28)
- **Target Android SDK**: Android 14 (API Level 34)
- **Health Connect Client**: `androidx.health.connect:connect-client:1.1.0-alpha10`

---

## ⚙️ 3. Android Studio Setup

1. **Clone / Open Repository**:
   Open the root directory in Android Studio. Android Studio will automatically recognize `settings.gradle.kts` and `app/build.gradle.kts`.
2. **Gradle Sync**:
   Allow Android Studio to sync dependencies via Gradle Kotlin DSL.
3. **JDK Configuration**:
   Ensure JDK 17 or JDK 21 is selected under **Settings -> Build, Execution, Deployment -> Build Tools -> Gradle -> Gradle JDK**.

---

## 🏥 4. Health Connect Setup

On Android 14+ (API 34+), **Health Connect** is built directly into the operating system settings under **Settings -> Security & Privacy -> Privacy -> Health Connect**.

For Android 9 through Android 13:
1. Open Google Play Store on the device or emulator.
2. Search and install **Health Connect by Google**.
3. Launch Health Connect to complete initial onboarding.

---

## 🔐 5. Required Permissions

MediLink AI requests ONLY the minimum required permissions:

- `android.permission.health.READ_HEART_RATE`: Reads Heart Rate samples in beats per minute.
- `android.permission.health.READ_STEPS`: Reads step counts aggregated for today.

Permissions are declared in `AndroidManifest.xml` and dynamically requested using the official Health Connect permission contract launcher (`PermissionController.createRequestPermissionResultContract()`).

---

## 🚀 6. How to Run the Application

1. Connect a physical Android device (Android 9+) via USB with USB Debugging enabled, OR start an Android Virtual Device (AVD Emulator) running API 28+.
2. Select the `app` run configuration in Android Studio.
3. Click **Run ('Shift + F10')**.

### Expected User Flow:
1. **Initial Screen**: MediLink AI opens showing the permission prompt screen ("Connect your health data").
2. **Tap Button**: User taps **[ Connect Health Data ]**.
3. **System Permission Dialog**: The native Android Health Connect permission modal opens requesting read access to Heart Rate and Steps.
4. **Grant Access**: User toggles permission switches ON and taps **Allow**.
5. **Return to App**: MediLink AI displays **✓ Health Connect Connected** status.
6. **Dashboard Vitals**: The app reads live records from Health Connect and presents Heart Rate (BPM, timestamp, status) and Steps (count, timeframe).
7. **Refresh Action**: Pressing **[ Refresh Health Data ]** re-executes queries with a progress indicator.

---

## 🔄 7. How the Data Flow Works

```
[ Smartwatch / Wear OS Device ]
             │
             ▼
[ Manufacturer Health App (e.g. Fitbit, Samsung Health, Garmin) ]
             │
             ▼
[ Android Health Connect System Service ]
             │
             ▼  (HealthConnectManager.kt / readRecords & aggregate)
[ MediLink AI Android App ]
             │
             ▼  (HealthViewModel.kt / StateFlow)
[ Jetpack Compose Dashboard UI ]
```

---

## 🧪 8. How to Test Without a Smartwatch

You can test MediLink AI on an emulator or physical phone without a smartwatch using sample data:

### Method A: Using Google's Health Connect Toolbox (Recommended)
1. Download **Health Connect Toolbox** from the Google Play Store or build it from [GitHub - android/health-connect-samples](https://github.com/android/health-connect-samples).
2. Open Health Connect Toolbox.
3. Select **Heart Rate**, enter `82` BPM, and tap **Insert Record**.
4. Select **Steps**, enter `5240` steps, and tap **Insert Record**.
5. Re-open **MediLink AI** and tap **[ Refresh Health Data ]**. The inserted metrics will immediately display on the dashboard!

### Method B: Testing Zero-Data Handling
If no health data exists in Health Connect, MediLink AI will clearly report:
- ❤️ Heart Rate: `"No heart-rate data available."`
- 🚶 Steps: `"No step data available."`

MediLink AI **never** fabricates fake health numbers.

---

## ⚠️ 9. Known Limitations

- **Local Scope**: Data is currently stored only in in-memory UI state and is not persisted to external servers or cloud storage.
- **Provider App Requirement**: Requires Health Connect app or provider to be installed on pre-Android 14 devices.
- **Read-Only**: This version performs read-only operations and does not write back synthetic health records.

---

## 🌐 10. Future Smartwatch & Ecosystem Architecture

In future milestones, MediLink AI will expand into a full remote patient monitoring ecosystem:

```
Smartwatch -> Health Connect -> MediLink AI App -> Node.js Backend -> MongoDB -> AI Health Engine -> Doctor Portal
```

---

## 📱 11. Layout & UI Specification

- **Header**: MEDILINK AI | AI-Powered Healthcare
- **Status Card**: Health Connect | ✓ Connected
- **Heart Rate Card**: ❤️ HEART RATE | 82 BPM | Last updated: 21 Aug 2026, 01:30 PM | 🟢 Data received
- **Steps Card**: 🚶 STEPS | 5,240 | Today
- **Data Source**: Health Connect | AndroidX Client
- **Buttons**: `[ Refresh Health Data ]` | `[ Health Connect Permissions ]`
- **Footer**: Connection Status: ✓ Connected

---

## ❓ 12. Troubleshooting

### Issue 1: "Health Connect is not available on this device"
- **Fix**: Install "Health Connect" from Google Play Store if using Android 13 or lower. Ensure the device is running API 28+.

### Issue 2: "Health data permission was denied"
- **Fix**: Tap **[ Health Connect Permissions ]** inside MediLink AI or navigate to **Settings -> Apps -> Health Connect -> App permissions -> MediLink AI** and enable Heart Rate and Steps read permissions.

### Issue 3: "No heart-rate data available"
- **Fix**: Use Health Connect Toolbox or a paired health app (Fitbit, Google Fit, Samsung Health) to log at least one heart rate record in Health Connect.
