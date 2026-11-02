// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The building blocks of the app's window, in DenaDesk's Aurora look (concepts/2-aurora.html):
// always dark, glass cards on near-black, Geist type, and the spectral gradient used sparingly
// (switches that are on, primary buttons, the link line, a glow at the bottom edge). A sidebar of
// icon tiles in groups, cards of rows (label and hint on the left, the control on the right), page
// headings with one main switch, the direction cards ("Mac → Tablet") and the layout picker.
package com.denarmo.denadesk

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Shapes
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ---- colours (concepts/2-aurora.html :root) ----

// The spectrum, one hue per kind of feature; grey for the app's own pages.
object Hue {
    val pink = Color(0xFFE2B52F)
    val violet = Color(0xFFF1C40F)
    val cyan = Color(0xFFF7DD77)
    val green = Color(0xFF3DFFA8)
    val amber = Color(0xFFFFB340)
    val grey = Color(0xFFB4B4BC)
}

// The spectral gradient (the mockup's --spec), left to right.
val SpecBrush: Brush = Brush.horizontalGradient(listOf(Color(0xFFE2B52F), Color(0xFFF1C40F), Color(0xFFF7DD77)))

val Geist: FontFamily = FontFamily(
    Font(R.font.geist_light, FontWeight.Light), Font(R.font.geist_regular, FontWeight.Normal), Font(R.font.geist_medium, FontWeight.Medium),
    Font(R.font.geist_semibold, FontWeight.SemiBold), Font(R.font.geist_bold, FontWeight.Bold),
)
val GeistMono: FontFamily = FontFamily(Font(R.font.geist_mono_regular, FontWeight.Normal))

data class Palette(
    val accent: Color, val accentSoft: Color, val content: Color, val sidebar: Color, val card: Color, val line: Color,
    val text: Color, val muted: Color, val faint: Color, val good: Color, val warn: Color, val bad: Color, val trackOff: Color, val hover: Color,
    // An opaque card (dialogs, the bottom bar: `card` is see-through glass) and the stronger hairline.
    val surface: Color = Color(0xFF29292E), val line2: Color = Color(0x1FFFFFFF),
)

private val Aurora = Palette(
    accent = Color(0xFFF1C40F), accentSoft = Color(0x29F1C40F), content = Color(0xFF202024), sidebar = Color(0xFF202024), card = Color(0x09FFFFFF),
    line = Color(0x12FFFFFF), text = Color(0xFFF1F1F3), muted = Color(0xFFB7B7C2), faint = Color(0xFFA0A0AA),
    good = Color(0xFF3DFFA8), warn = Color(0xFFFFB340), bad = Color(0xFFFF5C7A), trackOff = Color(0x1AFFFFFF), hover = Color(0x0FFFFFFF),
)

val LocalPalette = staticCompositionLocalOf { Aurora }
val pal: Palette @Composable get() = LocalPalette.current

private val AuroraShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp), small = RoundedCornerShape(14.dp), medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(24.dp), extraLarge = RoundedCornerShape(28.dp),
)

private val AuroraType = Typography().let { t ->
    Typography(
        displayLarge = t.displayLarge.copy(fontFamily = Geist), displayMedium = t.displayMedium.copy(fontFamily = Geist), displaySmall = t.displaySmall.copy(fontFamily = Geist),
        headlineLarge = t.headlineLarge.copy(fontFamily = Geist), headlineMedium = t.headlineMedium.copy(fontFamily = Geist), headlineSmall = t.headlineSmall.copy(fontFamily = Geist),
        titleLarge = t.titleLarge.copy(fontFamily = Geist), titleMedium = t.titleMedium.copy(fontFamily = Geist), titleSmall = t.titleSmall.copy(fontFamily = Geist),
        bodyLarge = t.bodyLarge.copy(fontFamily = Geist), bodyMedium = t.bodyMedium.copy(fontFamily = Geist), bodySmall = t.bodySmall.copy(fontFamily = Geist),
        labelLarge = t.labelLarge.copy(fontFamily = Geist), labelMedium = t.labelMedium.copy(fontFamily = Geist), labelSmall = t.labelSmall.copy(fontFamily = Geist),
    )
}

// Always dark, whatever the system says.
@Composable
fun Theme(content: @Composable () -> Unit) {
    val p = Aurora
    val scheme = darkColorScheme(
        primary = p.accent, onPrimary = p.content, primaryContainer = p.accentSoft, onPrimaryContainer = p.text,
        secondary = Hue.cyan, onSecondary = p.content, secondaryContainer = p.accentSoft, onSecondaryContainer = p.text,
        tertiary = Hue.green, onTertiary = p.content, error = p.bad, onError = p.content,
        background = p.content, onBackground = p.text, surface = p.content, onSurface = p.text,
        surfaceVariant = p.surface, onSurfaceVariant = p.muted, outline = Color(0x29FFFFFF), outlineVariant = p.line,
        inverseSurface = p.text, inverseOnSurface = p.content, inversePrimary = p.accent, scrim = Color.Black,
        surfaceBright = Color(0xFF1A1A1E), surfaceDim = p.content, surfaceContainerLowest = p.content, surfaceContainerLow = p.sidebar,
        surfaceContainer = p.surface, surfaceContainerHigh = p.surface, surfaceContainerHighest = Color(0xFF1A1A1E),
    )
    CompositionLocalProvider(LocalPalette provides p) {
        MaterialTheme(colorScheme = scheme, shapes = AuroraShapes, typography = AuroraType) {
            CompositionLocalProvider(LocalContentColor provides p.text, content = content)
        }
    }
}

// The aurora at a surface's bottom edge: five soft spots of the spectrum, flattened to `height`.
// Drawn behind the content, so put it after clip() and background(). Plain gradients, no blur
// (RenderEffect needs Android 12).
private val GlowSpots = listOf(.1f to Hue.pink, .3f to Hue.violet, .5f to Hue.cyan, .7f to Hue.green, .9f to Hue.amber)

fun Modifier.auroraGlow(strength: Float = .35f, height: Dp = 70.dp): Modifier = drawBehind {
    val r = size.width * .26f
    val h = height.toPx()
    if (r <= 0f || h <= 0f) return@drawBehind
    for ((x, c) in GlowSpots) {
        val o = Offset(size.width * x, size.height)
        scale(1f, h / r, pivot = o) {
            drawCircle(Brush.radialGradient(listOf(c.copy(alpha = strength), Color.Transparent), center = o, radius = r), radius = r, center = o)
        }
    }
}

// ---- icons: mac/control.js ICONS, the same 20×20 line drawings ----

private fun lineIcon(name: String, d: String): ImageVector = ImageVector.Builder(name, 24.dp, 24.dp, 20f, 20f).apply {
    addPath(
        pathData = PathParser().parsePathString(d).toNodes(), fill = null, stroke = SolidColor(Color.Black),
        strokeLineWidth = 1.8f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
    )
}.build()

object Ico {
    val overview = lineIcon("overview", "M3 9.5 10 4l7 5.5V17H3z M8 17v-4h4v4")
    val link = lineIcon("link", "M8.5 11.5a3.2 3.2 0 0 0 4.5 0l2.5-2.5a3.2 3.2 0 0 0-4.5-4.5l-.8.8 M11.5 8.5a3.2 3.2 0 0 0-4.5 0L4.5 11a3.2 3.2 0 0 0 4.5 4.5l.8-.8")
    val display = lineIcon("display", "M3 4h14v9H3z M7 17h6 M10 13v4")
    val cursor = lineIcon("cursor", "M5 3l10 6-4.5 1.2L8.5 15z")
    val keyboard = lineIcon("keyboard", "M2.5 6h15v8h-15z M5.5 9h1 M8.5 9h1 M11.5 9h1 M14.5 9h0 M6.5 11.5h7")
    val rezume = lineIcon("rezume", "M2 4.5h8v6H2z M1 12.5h10 M13.5 6.5h4.5v10h-4.5z M15.2 14.5h1.1 M3.5 16h6 M8 14.4l1.6 1.6L8 17.6")
    val remote = lineIcon("remote", "M6.5 6.5h7a4 4 0 0 1 4 4v1.5a2.8 2.8 0 0 1-5 1.7L11.4 12H8.6l-1.1 1.7a2.8 2.8 0 0 1-5-1.7v-1.5a4 4 0 0 1 4-4z M6 8.5v3 M4.5 10h3 M13 9.5h0 M14.5 11h0")
    val clipboard = lineIcon("clipboard", "M6 4h8v13H6z M8 3h4v2.5H8z M8 9h4 M8 12h4")
    val files = lineIcon("files", "M3 5h5l1.5 2H17v9H3z")
    val audio = lineIcon("audio", "M4 8h3l4-3v10l-4-3H4z M14 7.5c1 .8 1 4.2 0 5 M16 5.5c2.2 1.8 2.2 7.2 0 9")
    val general = lineIcon("general", "M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M10 2.5v2 M10 15.5v2 M2.5 10h2 M15.5 10h2 M4.7 4.7l1.4 1.4 M13.9 13.9l1.4 1.4 M4.7 15.3l1.4-1.4 M13.9 6.1l1.4-1.4")
    val about = lineIcon("about", "M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z M10 9v5 M10 6.2v.1")
    val bell = lineIcon("bell", "M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5h-12z M8.5 16.5a1.5 1.5 0 0 0 3 0")
    val phone = lineIcon("phone", "M6.5 2.5h7a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z M9 15h2")
    val more = lineIcon("more", "M4.5 10h.1 M10 10h.1 M15.5 10h.1")
    val call = lineIcon("call", "M6 3h2.5l1.2 3.2-1.7 1.3a9 9 0 0 0 4.5 4.5l1.3-1.7 3.2 1.2V16a1 1 0 0 1-1 1A13 13 0 0 1 3 4a1 1 0 0 1 1-1z")
    val message = lineIcon("message", "M3 4.5h14v9H8.5L5 16.5v-3H3z")
    val camera = lineIcon("camera", "M2.5 6h10v8h-10z M12.5 8.5l5-2.5v8l-5-2.5")
    val photo = lineIcon("photo", "M3 4.5h14v11H3z M3 13l4-4 3.5 3.5 2-2L17 14.5 M12.5 7.5h.1")
    val folder = lineIcon("folder", "M2.5 5h5.5l1.5 2h8v9.5h-15z")
}

// A sidebar tile: the icon in its section's hue (the last of `colors`) on glass, brighter when on.
@Composable
fun Tile(icon: ImageVector, colors: List<Color>, size: Int = 26, on: Boolean = false) {
    val s = RoundedCornerShape((size * 0.33f).dp)
    Box(
        Modifier.size(size.dp).clip(s).background(Color(if (on) 0x17FFFFFF else 0x0DFFFFFF)).border(1.dp, if (on) pal.line2 else pal.line, s),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, null, tint = colors.lastOrNull() ?: pal.text, modifier = Modifier.size((size * 0.62f).dp)) }
}

// The mark: two screens on a dark tile with the aurora under them.
@Composable
fun Logo(size: Int) {
    val s = RoundedCornerShape((size * 0.3f).dp)
    Box(
        Modifier.size(size.dp).clip(s).background(Color(0xFF111114)).auroraGlow(.55f, (size * 0.45f).dp).border(1.dp, pal.line2, s),
        contentAlignment = Alignment.Center,
    ) { Icon(painterResource(R.drawable.ic_stat), "DenaDesk", tint = pal.accent, modifier = Modifier.size((size * 0.56f).dp)) }
}

@Composable
fun Dot(color: Color, size: Int = 8) = Box(Modifier.size(size.dp).clip(CircleShape).background(color))

// One sidebar entry (the mockup's `.nv`): tile, label, and a green dot when the feature is on.
@Composable
fun NavItem(icon: ImageVector, colors: List<Color>, label: String, selected: Boolean, on: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    val s = RoundedCornerShape(12.dp)
    Row(
        Modifier.fillMaxWidth().height(40.dp).clip(s).alpha(if (enabled) 1f else 0.4f)
            .background(if (selected) Color(0x0FFFFFFF) else Color.Transparent).border(1.dp, if (selected) pal.line else Color.Transparent, s)
            .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Tile(icon, colors, on = selected)
        Text(label, color = if (selected) pal.text else pal.muted, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 10.dp).weight(1f))
        if (on) Dot(pal.good, 7)
    }
}

// ---- page parts ----

@Composable
fun PageHead(title: String, desc: String, master: Boolean? = null, onMaster: (Boolean) -> Unit = {}) {
    Row(verticalAlignment = Alignment.Top, modifier = Modifier.padding(bottom = 14.dp)) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 28.sp, fontWeight = FontWeight.Light, letterSpacing = (-0.8).sp, color = pal.text)
            if (desc.isNotEmpty()) Text(desc, color = pal.muted, fontSize = 14.sp, modifier = Modifier.padding(top = 2.dp))
        }
        if (master != null) MacSwitch(master, onMaster)
    }
}

// A pill switch: the spectrum when on, a dim glass track when off.
@Composable
fun MacSwitch(on: Boolean, onChange: (Boolean) -> Unit, enabled: Boolean = true) {
    val x by animateDpAsState(if (on) 20.dp else 2.dp, label = "thumb")
    Box(
        Modifier.minimumInteractiveComponentSize().alpha(if (enabled) 1f else 0.4f)
            .toggleable(value = on, interactionSource = remember { MutableInteractionSource() }, indication = null, enabled = enabled, role = Role.Switch, onValueChange = onChange),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.size(44.dp, 26.dp).clip(CircleShape).background(if (on) SpecBrush else SolidColor(pal.trackOff))
                .border(1.dp, if (on) Color.Transparent else pal.line2, CircleShape),
            contentAlignment = Alignment.CenterStart,
        ) { Box(Modifier.offset(x = x).size(22.dp).clip(CircleShape).background(if (on) Color.White else Color(0xFFB4B4BC))) }
    }
}

// A card with an optional title above it (the mockup's `.dev`): glass, a hairline, and with
// `glow` the aurora at its bottom edge.
private val CardBrush = Brush.verticalGradient(listOf(Color(0x0BFFFFFF), Color(0x04FFFFFF)))

@Composable
fun MacCard(title: String = "", modifier: Modifier = Modifier, glow: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val s = RoundedCornerShape(22.dp)
    Column(modifier.padding(bottom = 16.dp)) {
        if (title.isNotEmpty()) Text(title, fontFamily = GeistMono, fontSize = 11.5.sp, letterSpacing = 0.5.sp, color = pal.muted, modifier = Modifier.padding(start = 4.dp, bottom = 8.dp))
        Column(
            Modifier.fillMaxWidth().clip(s).background(CardBrush).let { if (glow) it.auroraGlow() else it }.border(BorderStroke(1.dp, pal.line), s),
            content = content,
        )
    }
}

// A row: label and hint on the left, controls on the right; a hairline between rows. Controls too
// wide to leave the label room (under ~half the row) go on their own line under it, at the right.
@Composable
fun MacRow(label: String, hint: String = "", first: Boolean = false, onClick: (() -> Unit)? = null, controls: @Composable RowScope.() -> Unit = {}) {
    Column {
        if (!first) Box(Modifier.padding(start = 16.dp).fillMaxWidth().height(1.dp).background(pal.line))
        Layout(
            content = {
                Column {
                    Text(label, color = pal.text, fontSize = 15.sp)
                    if (hint.isNotEmpty()) Text(hint, color = pal.muted, fontSize = 12.5.sp, modifier = Modifier.padding(top = 1.dp))
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), content = controls)
            },
            modifier = Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }.padding(horizontal = 16.dp, vertical = 12.dp),
        ) { ms, c ->
            val w = c.maxWidth
            val ctl = ms[1].measure(Constraints(maxWidth = w))
            val gap = if (ctl.width > 0) 12.dp.roundToPx() else 0
            if (w - ctl.width - gap >= w * 0.45f) {
                val lbl = ms[0].measure(Constraints(maxWidth = w - ctl.width - gap))
                val h = maxOf(lbl.height, ctl.height)
                layout(w, h) {
                    lbl.place(0, (h - lbl.height) / 2)
                    ctl.place(w - ctl.width, (h - ctl.height) / 2)
                }
            } else {
                val lbl = ms[0].measure(Constraints(maxWidth = w))
                val v = 10.dp.roundToPx()
                layout(w, lbl.height + v + ctl.height) {
                    lbl.place(0, 0)
                    ctl.place(w - ctl.width, lbl.height + v)
                }
            }
        }
    }
}

@Composable
fun SwitchRow(label: String, hint: String, on: Boolean, first: Boolean = false, enabled: Boolean = true, onChange: (Boolean) -> Unit) =
    MacRow(label, hint, first) { MacSwitch(on, onChange, enabled) }

// A note in a tinted box: info, warn or bad.
@Composable
fun Note(text: String, kind: String = "info") {
    if (text.isEmpty()) return
    val c = when (kind) { "bad" -> pal.bad; "warn" -> pal.warn; else -> pal.accent }
    val bg = when (kind) { "bad" -> pal.bad.copy(alpha = 0.12f); "warn" -> pal.warn.copy(alpha = 0.12f); else -> pal.accentSoft }
    val s = RoundedCornerShape(16.dp)
    Text(text, color = pal.text, fontSize = 13.5.sp, modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp).clip(s).background(bg)
        .border(1.dp, c.copy(alpha = 0.25f), s).padding(horizontal = 14.dp, vertical = 12.dp))
}

@Composable
fun Pill(text: String, kind: String = "") {
    val c = when (kind) { "good" -> pal.good; "bad" -> pal.bad; "warn" -> pal.warn; "muted" -> pal.muted; else -> pal.accent }
    Text(text, color = c, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.clip(CircleShape).background(c.copy(alpha = 0.14f)).padding(horizontal = 9.dp, vertical = 2.dp))
}

// The main action: dark text on the spectrum, a full pill.
@Composable
fun PrimaryButton(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val ink = Color(0xFF202024)
    Button(
        onClick = onClick, enabled = enabled, shape = CircleShape,
        modifier = modifier.heightIn(min = 48.dp).alpha(if (enabled) 1f else 0.4f).clip(CircleShape).background(SpecBrush),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, contentColor = ink, disabledContainerColor = Color.Transparent, disabledContentColor = ink),
    ) { Text(label, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

// Everything else: a glass pill with a hairline; `color` tints the label (bad for hang up, say).
@Composable
fun SecondaryButton(label: String, modifier: Modifier = Modifier, enabled: Boolean = true, color: Color = Color.Unspecified, onClick: () -> Unit) {
    val c = if (color == Color.Unspecified) pal.text else color
    OutlinedButton(
        onClick = onClick, modifier = modifier, enabled = enabled, shape = CircleShape,
        border = BorderStroke(1.dp, if (color == Color.Unspecified) pal.line2 else c.copy(alpha = 0.35f)),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0x12FFFFFF), contentColor = c, disabledContainerColor = Color(0x08FFFFFF), disabledContentColor = pal.faint),
    ) { Text(label, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

// A direction card's head: device glyph + name, the spectral link line, the other device.
@Composable
fun DirHead(from: String, fromPhone: Boolean, to: String, toPhone: Boolean) {
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(if (fromPhone) Ico.phone else Ico.display, null, tint = pal.accent, modifier = Modifier.size(18.dp))
        Text(from, fontWeight = FontWeight.SemiBold, color = pal.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 6.dp).weight(1f, false))
        Box(Modifier.weight(1f).padding(horizontal = 10.dp).height(2.dp).clip(RoundedCornerShape(1.dp)).background(SpecBrush))
        Text("›", color = pal.text, fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 8.dp))
        Icon(if (toPhone) Ico.phone else Ico.display, null, tint = pal.muted, modifier = Modifier.size(18.dp))
        Text(to, fontWeight = FontWeight.SemiBold, color = pal.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 6.dp).weight(1f, false))
    }
}

@Composable
fun MacSlider(value: Float, range: ClosedFloatingPointRange<Float>, steps: Int, format: (Float) -> String, onDone: (Float) -> Unit) {
    var v by remember(value) { mutableFloatStateOf(value) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Slider(v, { v = it }, valueRange = range, steps = steps, onValueChangeFinished = { onDone(v) }, modifier = Modifier.width(170.dp),
            colors = SliderDefaults.colors(thumbColor = Color.White, activeTrackColor = pal.accent, inactiveTrackColor = pal.trackOff))
        Text(format(v), color = pal.muted, fontSize = 13.sp, modifier = Modifier.width(52.dp), textAlign = TextAlign.End)
    }
}

// The layout picker (the Mac's Cursor page): this device in the middle, a slot on each side for
// the computer; tap a side to move it there.
@Composable
fun LayoutPicker(me: String, other: String, side: String, onPick: (String) -> Unit) {
    @Composable
    fun Slot(s: String, modifier: Modifier) {
        val on = side == s
        Box(
            modifier.clip(RoundedCornerShape(14.dp))
                .background(if (on) pal.accentSoft else Color.Transparent)
                .border(BorderStroke(if (on) 2.dp else 1.dp, if (on) pal.accent else pal.faint.copy(alpha = 0.6f)), RoundedCornerShape(14.dp))
                .clickable { onPick(s) },
            contentAlignment = Alignment.Center,
        ) { if (on) Text(other, color = pal.accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, textAlign = TextAlign.Center, modifier = Modifier.padding(4.dp)) }
    }
    Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Slot("top", Modifier.width(150.dp).height(44.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Slot("left", Modifier.width(90.dp).height(100.dp))
            Box(
                Modifier.width(150.dp).height(100.dp).clip(RoundedCornerShape(16.dp)).background(SpecBrush),
                contentAlignment = Alignment.Center,
            ) { Text(me, color = Color(0xFF202024), fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, modifier = Modifier.padding(6.dp)) }
            Slot("right", Modifier.width(90.dp).height(100.dp))
        }
        Slot("bottom", Modifier.width(150.dp).height(44.dp))
        val where = mapOf("left" to "to the left of", "right" to "to the right of", "top" to "above", "bottom" to "below")[side]
        Text("$other is $where $me. Tap a side to move it.", color = pal.muted, fontSize = 13.sp, textAlign = TextAlign.Center)
    }
}
