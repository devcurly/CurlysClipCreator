import subprocess
import json
import re
import tempfile


def detect_scenes_ffmpeg(video_path: str, threshold: float = 0.3) -> list[float]:
    cmd = [
        "ffmpeg", "-i", video_path,
        "-filter:v", f"select='gt(scene,{threshold})',showinfo",
        "-f", "null", "-"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
    timestamps = []
    for line in result.stderr.split("\n"):
        if "pts_time:" in line:
            match = re.search(r"pts_time:(\d+\.?\d*)", line)
            if match:
                t = float(match.group(1))
                if t > 0.1:
                    timestamps.append(t)
    return timestamps


def get_video_duration(video_path: str) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json", video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except (KeyError, json.JSONDecodeError, TypeError, ValueError):
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "stream=duration",
            "-of", "json", video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            data = json.loads(result.stdout)
            for stream in data.get("streams", []):
                dur = stream.get("duration")
                if dur:
                    return float(dur)
        except (KeyError, json.JSONDecodeError, TypeError, ValueError):
            pass

        cmd = ["ffprobe", "-v", "error", "-show_format", "-of", "json", video_path]
        result = subprocess.run(cmd, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            data = json.loads(result.stdout)
            return float(data["format"]["duration"])
        except (KeyError, json.JSONDecodeError, TypeError, ValueError):
            pass

        cmd = ["ffmpeg", "-i", video_path]
        result = subprocess.run(cmd, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
        if match:
            h, m, s = float(match.group(1)), float(match.group(2)), float(match.group(3))
            return h * 3600 + m * 60 + s

        return 0.0


def build_scene_ranges(timestamps: list[float], duration: float) -> list[dict]:
    if not timestamps:
        return [{"index": 1, "start": 0.0, "end": duration}]

    scenes = []
    prev = 0.0
    for i, t in enumerate(timestamps):
        scenes.append({"index": i + 1, "start": prev, "end": t})
        prev = t
    scenes.append({"index": len(timestamps) + 1, "start": prev, "end": duration})
    return scenes
