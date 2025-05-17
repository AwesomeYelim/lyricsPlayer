import yt_dlp
import os
import whisper
import re
from sentence_transformers import SentenceTransformer, util


def download_subtitles(url, output='subs.vtt'):
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['ko'],
        'outtmpl': 'temp',
        'quiet': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        subtitles = info.get('subtitles') or info.get('automatic_captions')
        if not subtitles:
            print("❌ 자막을 찾을 수 없습니다.")
            return None

        if 'ko' not in subtitles and 'en' not in subtitles:
            print("❌ 'ko' 또는 'en' 자막이 없습니다.")
            return None

        ydl.download([url])

        for ext in ['vtt', 'srt']:
            fname = f'temp.ko.{ext}'
            if os.path.exists(fname):
                os.rename(fname, output)
                print(f"✅ 자막을 {output} 파일로 저장했습니다.")
                return output
    return None


def vtt_to_lrc(vtt_path, lrc_path):
    with open(vtt_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    lrc_lines = []
    time_pattern = re.compile(r'(\d+):(\d+):(\d+).(\d+) -->')
    last_lyric = None  # 직전 가사 저장용

    for i, line in enumerate(lines):
        match = time_pattern.match(line)
        if match:
            h, m, s, ms = map(int, match.groups())
            total_minutes = h * 60 + m
            lrc_time = f"[{total_minutes:02d}:{s:02d}.{int(ms / 10):02d}]"

            if i + 1 < len(lines):
                lyric = lines[i + 1].strip()

                if len(lyric) <= 1:
                    continue
                if re.match(r'^\[*[음악Music♪.·…~!?]*\]*$', lyric, re.IGNORECASE):
                    continue

                if lyric == last_lyric:
                    continue

                last_lyric = lyric
                lrc_lines.append(f"{lrc_time}{lyric}")

    with open(lrc_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lrc_lines))
    print(f"✅ {vtt_path} → {lrc_path} 변환 완료 (중복 및 전주 필터 적용됨)")

def whisper_result_to_lrc(result, lrc_path):
    lrc_lines = []
    last_text = None  # 직전 문장 기억

    for segment in result['segments']:
        start = segment['start']
        minutes = int(start // 60)
        seconds = int(start % 60)
        hundredths = int((start % 1) * 100)
        timestamp = f"[{minutes:02d}:{seconds:02d}.{hundredths:02d}]"

        text = segment['text'].strip()
        text = re.sub(r'\s+', ' ', text)  # 공백 정리

        # ⛔️ 중복 제거 필터
        if text == last_text or text in [line[10:] for line in lrc_lines[-3:]]:
            continue
        last_text = text

        lrc_lines.append(f"{timestamp}{text}")

    with open(lrc_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lrc_lines))

    print(f"✅ Whisper 자막을 {lrc_path} 파일로 저장했습니다. (중복 제거됨)")

def transcribe_with_whisper(audio):
    model = whisper.load_model("base")
    print("🎙️ Whisper로 자막 생성 중...")
    result = model.transcribe(audio + ".mp3")

    filtered_segments = []
    for seg in result['segments']:
        text = seg['text'].strip()
        if len(text) <= 1:
            continue  # 너무 짧은 텍스트는 무시
        if all(char in "♪.•…~[]" for char in text):
            continue  # 무의미한 특수기호만 있는 경우
        filtered_segments.append(seg)

    result['segments'] = filtered_segments
    return result


def download_audio(url, output='audio'):
    if os.path.exists('audio.mp3'):
        os.remove('audio.mp3')

    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': output,
        'quiet': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    return output + '.mp3'

from sentence_transformers import SentenceTransformer, util

def replace_lrc_lyrics(lrc_path, txt_path, similarity_threshold=0.6):
    model = SentenceTransformer('all-MiniLM-L6-v2')

    with open(lrc_path, 'r', encoding='utf-8') as f:
        lrc_lines = f.readlines()

    timestamps = []
    original_lyrics = []
    for line in lrc_lines:
        if ']' in line:
            ts, lyric = line.split(']', 1)
            timestamps.append(ts + ']')
            original_lyrics.append(lyric.strip())
        else:
            timestamps.append('')
            original_lyrics.append(line.strip())

    with open(txt_path, 'r', encoding='utf-8') as f:
        clean_lyrics = [line.strip() for line in f if line.strip()]

    original_embeddings = model.encode(original_lyrics, convert_to_tensor=True)
    clean_embeddings = model.encode(clean_lyrics, convert_to_tensor=True)

    new_lyrics = []
    used = [False] * len(clean_lyrics)

    for i, orig in enumerate(original_lyrics):
        sims = util.pytorch_cos_sim(original_embeddings[i], clean_embeddings)
        best_idx = sims.argmax().item()
        score = sims[0][best_idx].item()

        if score >= similarity_threshold and not used[best_idx]:
            new_lyrics.append(clean_lyrics[best_idx])
            used[best_idx] = True
        elif score >= similarity_threshold:
            # 반복 허용 (이미 사용된 것도 가능)
            new_lyrics.append(clean_lyrics[best_idx])
        else:
            # 매칭 실패 시 기존 Whisper 가사 유지
            new_lyrics.append(orig)

    replaced_lines = [f"{ts}{lyric}" for ts, lyric in zip(timestamps, new_lyrics)]

    with open(lrc_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(replaced_lines))

    print("✅ 의미 기반으로 LRC 가사가 정제되었고, 매칭 실패 시 원본 가사로 유지했습니다.")


def main(url):
    print("▶️ 자막 다운로드 시도...")
    subtitle_file = download_subtitles(url)

    if subtitle_file:
        lrc_file = "lyrics.lrc"
        vtt_to_lrc(subtitle_file, lrc_file)

        with open(lrc_file, 'r', encoding='utf-8') as f:
            print("🎤 LRC 가사 내용:")
            print(f.read())
    else:
        print("▶️ 자막 없으므로 오디오 다운로드 및 Whisper 변환 시작...")
        audio_file = "audio"
        download_audio(url, output=audio_file)
        result = transcribe_with_whisper(audio_file)
        lrc_path = "lyrics.lrc"
        whisper_result_to_lrc(result, lrc_path)

        # lyrics.txt 존재할 경우 정제된 가사로 교체
        if os.path.exists("lyrics.txt"):
            replace_lrc_lyrics(lrc_path, "lyrics.txt")

        with open(lrc_path, 'r', encoding='utf-8') as f:
            print("🎤 Whisper 기반 LRC 가사:")
            print(f.read())


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python script.py <youtube_url>")
    else:
        main(sys.argv[1])


