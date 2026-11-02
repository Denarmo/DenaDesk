// DenaDesk — GPL-3.0. Sample only the process IDs supplied by our main process.
using System;
using System.Collections.Generic;
using System.Diagnostics;
namespace MacShare
{
    static class ResourceUsage
    {
        public static List<object> Read(List<string> ids)
        {
            var rows = new List<object>();
            foreach (string id in ids)
            {
                int pid;
                if (rows.Count >= 32 || !Int32.TryParse(id, out pid) || pid <= 0) continue;
                try { using (var p = Process.GetProcessById(pid)) rows.Add(new Dictionary<string, object> {
                    { "pid", pid }, { "cpuSeconds", p.TotalProcessorTime.TotalSeconds }, { "workingSet", p.WorkingSet64 }
                }); } catch { } // a helper may exit during a sample
            }
            return rows;
        }
    }
}
