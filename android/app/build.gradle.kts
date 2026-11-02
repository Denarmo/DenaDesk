plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.denarmo.denadesk"
    compileSdk { version = release(37) }
    defaultConfig {
        applicationId = "com.denarmo.denadesk"
        minSdk = 29 // Android 10: wireless debugging needs 11, everything else works from 10
        targetSdk = 36
        versionCode = 20803
        versionName = "2.8.3"
    }
    // Both variants use the same identity and release key. Standard omits the
    // notification listener, SMS and Accessibility services. Full includes them;
    // the owner must choose any sensitive access in Android's own settings.
    flavorDimensions += "dist"
    productFlavors {
        create("standard") {
            dimension = "dist"
            buildConfigField("boolean", "NOTIF_LISTENER", "false")
            buildConfigField("boolean", "ACCESSIBILITY", "false")
        }
        create("full") {
            dimension = "dist"
            buildConfigField("boolean", "NOTIF_LISTENER", "true")
            buildConfigField("boolean", "ACCESSIBILITY", "true")
        }
    }
    signingConfigs {
        create("denadesk") {
            System.getenv("DENADESK_KEYSTORE")?.let { storeFile = file(it) }
            storePassword = System.getenv("DENADESK_STORE_PASSWORD")
            keyAlias = System.getenv("DENADESK_KEY_ALIAS") ?: "denadesk"
            keyPassword = System.getenv("DENADESK_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            // A release must use the stable private DenaDesk key, never a debug key.
            signingConfig = signingConfigs.getByName("denadesk")
        }
    }
    lint {
        checkReleaseBuilds = false
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("com.squareup.okhttp3:okhttp:5.5.0")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0") // Scan QR code (pairing): Google's scanner, no camera permission
}

// Record the reviewed source revision inside each APK, as the Windows build does.
val reviewAssets = layout.buildDirectory.dir("generated/denadeskAssets")
android.sourceSets.getByName("main").assets.srcDir(reviewAssets.get().asFile)
val writeBuildInfo = tasks.register("writeBuildInfo") {
    outputs.dir(reviewAssets)
    outputs.upToDateWhen { false }
    doLast {
        val repo = rootProject.projectDir.parentFile
        fun git(vararg args: String): String {
            val process = ProcessBuilder(listOf("git") + args).directory(repo).start()
            val output = process.inputStream.bufferedReader().readText().trim()
            check(process.waitFor() == 0) { "Cannot determine source revision" }
            return output
        }
        check(git("status", "--porcelain").isEmpty()) { "Commit reviewed changes before packaging" }
        val file = reviewAssets.get().file("build-info.json").asFile
        file.parentFile.mkdirs()
        file.writeText(groovy.json.JsonOutput.toJson(mapOf(
            "sourceRepository" to "https://github.com/Denarmo/DuoDesk",
            "sourceCommit" to git("rev-parse", "HEAD"),
            "version" to "2.8.3"
        )))
    }
}
tasks.named("preBuild") { dependsOn(writeBuildInfo) }
