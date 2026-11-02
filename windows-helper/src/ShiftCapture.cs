// DenaDesk — GPL-3.0. Preserve Shift across an input-sharing boundary.
using System;
using System.Collections.Generic;
namespace MacShare
{
    sealed class ShiftCapture
    {
        readonly HashSet<uint> local = new HashSet<uint>();
        readonly HashSet<uint> sent = new HashSet<uint>();
        static readonly uint[] shifts = { 0xA0, 0xA1 };
        public void Begin(Func<uint, bool> down)
        {
            End();
            foreach (uint vk in shifts) if (down(vk)) local.Add(vk);
        }
        // Called before a non-Shift key: its modifier arrives before its letter.
        public void Sync(Func<uint, bool> down, Action<uint, bool> emit)
        {
            foreach (uint vk in shifts)
            {
                if (down(vk)) { if (sent.Add(vk)) emit(vk, true); }
                else if (sent.Remove(vk)) emit(vk, false);
            }
        }
        public bool Observe(uint vk, bool down)
        {
            if (down) sent.Add(vk); else sent.Remove(vk);
            return !down && local.Remove(vk);
        }
        public bool ReleaseLocally(uint vk) { return local.Contains(vk); }
        public void End() { local.Clear(); sent.Clear(); }
    }
}
