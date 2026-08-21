package com.medilink.ai.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * Dedicated manager class for handling all Health Connect API operations:
 * - Availability checks
 * - Permission verification
 * - Heart Rate reading
 * - Steps aggregation
 * - Exception and error handling
 */
class HealthConnectManager(private val context: Context) {

    // Set of required Health Connect permissions for MediLink AI prototype
    val requiredPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class)
    )

    /**
     * Creates ActivityResultContract for requesting Health Connect permissions.
     */
    fun healthConnectClientContract() = PermissionController.createRequestPermissionResultContract()

    /**
     * Checks current Health Connect SDK availability status.
     * Returns true if available, false otherwise.
     */
    fun isAvailable(): Boolean {
        return HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    /**
     * Returns detailed availability status code.
     */
    fun getSdkStatus(): Int {
        return HealthConnectClient.getSdkStatus(context)
    }

    /**
     * Returns an instance of HealthConnectClient or null if unavailable.
     */
    private fun getClient(): HealthConnectClient? {
        return if (isAvailable()) {
            HealthConnectClient.getOrCreate(context)
        } else {
            null
        }
    }

    /**
     * Checks whether all required Health Connect permissions have been granted.
     */
    suspend fun hasAllPermissions(): Boolean {
        val client = getClient() ?: return false
        return try {
            val grantedPermissions = client.permissionController.getGrantedPermissions()
            grantedPermissions.containsAll(requiredPermissions)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Reads the latest Heart Rate record available in Health Connect from the last 7 days.
     * Returns a Pair of (BPM, FormattedTimestamp) or null if no data exists.
     */
    suspend fun readLatestHeartRate(): Pair<Long, String>? {
        val client = getClient() ?: return null
        return try {
            val startTime = Instant.now().minus(7, ChronoUnit.DAYS)
            val endTime = Instant.now()

            val request = ReadRecordsRequest(
                recordType = HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
            )

            val response = client.readRecords(request)

            // Extract samples from records and find the most recent sample by timestamp
            val latestSampleWithTime = response.records
                .flatMap { record ->
                    record.samples.map { sample -> sample to sample.time }
                }
                .maxByOrNull { it.second }

            latestSampleWithTime?.let { (sample, time) ->
                val formatter = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", Locale.getDefault())
                    .withZone(ZoneId.systemDefault())
                val formattedTime = formatter.format(time)
                Pair(sample.beatsPerMinute, formattedTime)
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Aggregates total step count for today (from 00:00:00 local time until now).
     * Returns total steps or null if no step records exist.
     */
    suspend fun readTodaySteps(): Pair<Long, String>? {
        val client = getClient() ?: return null
        return try {
            val startOfDay = ZonedDateTime.now().truncatedTo(ChronoUnit.DAYS).toInstant()
            val now = Instant.now()

            val response = client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startOfDay, now)
                )
            )

            val totalSteps = response[StepsRecord.COUNT_TOTAL]
            totalSteps?.let { steps ->
                val formatter = DateTimeFormatter.ofPattern("hh:mm a", Locale.getDefault())
                    .withZone(ZoneId.systemDefault())
                val formattedTime = formatter.format(now)
                Pair(steps, "Today (as of $formattedTime)")
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Reads all health data (Heart Rate & Steps) and constructs the HealthData payload.
     */
    suspend fun fetchHealthData(): HealthData {
        val hrResult = readLatestHeartRate()
        val stepsResult = readTodaySteps()

        return HealthData(
            heartRate = hrResult?.first,
            heartRateTimestamp = hrResult?.second,
            steps = stepsResult?.first,
            stepsDate = stepsResult?.second ?: "Today",
            dataSource = "Health Connect"
        )
    }
}
