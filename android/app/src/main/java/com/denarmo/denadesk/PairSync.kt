// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Two-way switches shared with the computer, remembered per pair (mac/pairsync.js): the
// computer hosts, so after welcome it sends all of them and we adopt them; after that either side
// sends one when its person flips it. Directions are told from the sender's side.
package com.denarmo.denadesk

import org.json.JSONObject

class PairSync(core: Core) : Feature(core) {
    // feature -> our settings keys for out (ours shown there) / in (theirs shown here)
    private val keys = mapOf(
        "clipboard" to ("clip.send" to "clip.receive"),
        "notifs" to ("notifs.send" to "notifs.receive"),
        "audio" to ("audio.send" to "audio.receive"), // out: the phone's sound on the Mac (the Mac plays it over adb)
        "cursor" to ("cursor.out" to "cursor.in"), // in: the Mac's mouse and keyboard used here
        "rezume" to ("rezume.send" to "rezume.receive"), // read and set through Rezume (its own on switch with them)
    )

    // Shared values, the same on both sides (the Mac's VALUES): stored as strings.
    // keyboard: off on a fresh install, like every feature.
    private val valueDefaults = mapOf("keyboard" to core.store.was.toString(), "speed" to "1", "reverseScroll" to "false", "gestures" to "true", "pace" to "fast", "ble" to "true")

    fun value(key: String): String = core.store.prefsString("value.$key", valueDefaults[key] ?: "")

    // The person changed a value here: the computer follows.
    fun setValue(key: String, v: Any) {
        core.store.setPrefsString("value.$key", v.toString())
        core.send(msg(Proto.T.PAIR_SYNC, "key" to key, "value" to v))
        core.changed()
    }

    private fun adoptValue(key: String, v: Any?) {
        if (key !in valueDefaults || v == null || v == org.json.JSONObject.NULL) return
        core.store.setPrefsString("value.$key", v.toString())
    }

    fun get(feature: String, dir: String): Boolean {
        if (feature == "rezume") return core.rezume.on && core.rezume.opt(if (dir == "out") "send" else "receive")
        val (o, i) = keys.getValue(feature)
        return core.store.flag(if (dir == "out") o else i, core.store.was && feature != "audio" && !(feature == "cursor" && dir == "out"))
    }

    // The person flipped a switch here: tell the computer, which follows.
    fun set(feature: String, dir: String, on: Boolean) {
        apply(feature, dir, on)
        core.send(msg(Proto.T.PAIR_SYNC, "feature" to feature, "dir" to dir, "on" to on))
        remember()
    }

    private fun apply(feature: String, dir: String, on: Boolean) {
        val (o, i) = keys[feature] ?: return
        val key = if (dir == "out") o else i
        if (get(feature, dir) == on) return
        if (feature == "rezume") {
            if (on && !core.rezume.on) core.rezume.set("on", true, sync = false)
            core.rezume.set(if (dir == "out") "send" else "receive", on, sync = false)
            sent["rezume.$dir"] = on
            rezumeChanged() // its on switch may have turned the other way on too: the computer hears that
            return
        }
        core.store.setFlag(key, on)
        when (feature) {
            "clipboard" -> core.clip.sendPolicy()
            "notifs" -> core.notifs.sendPolicy()
            "audio" -> core.macSound.sendPolicy()
        }
        core.changed()
    }

    override fun onWelcome(host: Host) {
        core.store.pairSync(host.id)?.let { saved ->
            for (f in keys.keys) saved.optJSONObject(f)?.let { v ->
                if (v.has("out")) apply(f, "out", v.optBoolean("out"))
                if (v.has("in")) apply(f, "in", v.optBoolean("in"))
            }
        }
    }

    override fun onMessage(t: String, m: JSONObject): Boolean {
        if (t != Proto.T.PAIR_SYNC) return false
        if (m.has("key")) {
            adoptValue(m.optString("key"), m.opt("value"))
            core.changed()
            return true
        }
        val all = m.optJSONObject("all")
        if (all != null) {
            all.optJSONObject("values")?.let { vals -> for (k in vals.keys()) adoptValue(k, vals.opt(k)) }
            for (f in keys.keys) all.optJSONObject(f)?.let { v ->
                apply(f, "out", v.optBoolean("in")) // their in = our out
                apply(f, "in", v.optBoolean("out"))
            }
        } else if (keys.containsKey(m.optString("feature"))) {
            val dir = m.optString("dir")
            if (dir == "out" || dir == "in") apply(m.getString("feature"), if (dir == "out") "in" else "out", m.optBoolean("on"))
        }
        remember()
        return true
    }

    // ReZume's switches were flipped here (its page): the computer follows what changed.
    private val sent = HashMap<String, Boolean>()
    fun rezumeChanged() {
        for (dir in listOf("out", "in")) {
            val on = get("rezume", dir)
            if (sent["rezume.$dir"] == on) continue
            sent["rezume.$dir"] = on
            core.send(msg(Proto.T.PAIR_SYNC, "feature" to "rezume", "dir" to dir, "on" to on))
        }
        remember()
    }

    private fun remember() {
        val h = core.host ?: return
        val o = JSONObject()
        for (f in keys.keys) o.put(f, JSONObject().put("out", get(f, "out")).put("in", get(f, "in")))
        core.store.setPairSync(h.id, o)
    }
}
