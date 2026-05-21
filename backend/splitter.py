import subprocess
import os
from pathlib import Path


def split_scene_sync(
    video_path: str,
    output_dir: str,
    scene_index: int,
    start: float,
    end: float
):
    duration = round(end - start, 3)
    if duration < 0.04:
        return None

    output_path = os.path.join(output_dir, f"Scene_{scene_index:03d}.mp4")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-ss", str(start),
        "-t", str(duration),
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "medium",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return None

    size = os.path.getsize(output_path)
    return {
        "index": scene_index,
        "filename": f"Scene_{scene_index:03d}.mp4",
        "path": output_path,
        "size": size,
        "duration": duration,
        "start": start,
        "end": end
    }


def split_all_scenes_sync(
    video_path: str,
    output_dir: str,
    scenes: list[dict]
) -> list[dict]:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    results = []

    for scene in scenes:
        result = split_scene_sync(
            video_path, output_dir,
            scene["index"], scene["start"], scene["end"]
        )
        if result:
            results.append(result)

    results.sort(key=lambda x: x["index"])
    return results
