"""Hypothetical raw camera payload calculation, not a hardware reproduction.

Sources: USB-IF https://www.usb.org/node/214 and Microsoft
https://learn.microsoft.com/en-us/windows/win32/medfound/recommended-8-bit-yuv-formats-for-video-rendering
Reported output format does not establish UVC wire encoding. No bandwidth
root cause, usable USB payload capacity, camera benchmark or fix is claimed.
"""
from fractions import Fraction
import json

modes = [(2560, 1440, 30), (1920, 1080, 30)]
rows = []
for fmt, bpp in [("YUY2", 16), ("NV12", 12)]:
    rates = [w * h * fps * bpp for w, h, fps in modes]
    total = sum(rates)
    assert total == sum(Fraction(w * h * bpp, 8) * fps * 8
                        for w, h, fps in modes)
    rows.append({"format": fmt, "bpp": bpp, "camera_bits_s": rates,
                 "sum_bits_s": total,
                 "ratio_to_nominal_usb2": str(Fraction(total, 480_000_000))})
assert rows[0]["sum_bits_s"] == 2_764_800_000
assert rows[1]["sum_bits_s"] == 2_073_600_000
assert all(rate > 480_000_000 for row in rows for rate in row["camera_bits_s"])
print(json.dumps({"hypothetical_raw_payload_only": True,
                  "hardware_reproduced": False, "rows": rows}, indent=2))
