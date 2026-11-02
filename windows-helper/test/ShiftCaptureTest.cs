using System;
using System.Collections.Generic;
using MacShare;
class ShiftCaptureTest
{
    static void Check(bool yes) { if (!yes) throw new Exception("Shift capture regression"); }
    static void Main()
    {
        var held = new HashSet<uint> { 0xA0 };
        var sent = new List<string>();
        var shifts = new ShiftCapture();
        shifts.Begin(vk => held.Contains(vk));
        shifts.Sync(vk => held.Contains(vk), (vk, down) => sent.Add(vk + ":" + down));
        Check(sent.Count == 1 && sent[0] == "160:True");
        shifts.Sync(vk => held.Contains(vk), (vk, down) => sent.Add(vk + ":" + down));
        Check(sent.Count == 1); // repeated letters keep Shift down
        Check(shifts.ReleaseLocally(0xA0)); // pressed at home: do not leave a sticky local Shift
        held.Clear();
        Check(shifts.Observe(0xA0, false));
        Check(!shifts.ReleaseLocally(0xA0));
        shifts.End();
        shifts.Begin(vk => false);
        Check(!shifts.Observe(0xA1, true));
        held.Add(0xA1);
        shifts.Sync(vk => held.Contains(vk), (vk, down) => sent.Add("duplicate"));
        Check(sent.Count == 1); // an ordinary remote Shift is not sent twice
        Check(!shifts.Observe(0xA1, false));
        Console.WriteLine("Shift crossing, repeat, left/right and local-release checks passed.");
    }
}
