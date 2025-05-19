import React, { useEffect, useRef, useState } from "react";

// LRC 파서: [mm:ss.xx] 또는 [hh:mm:ss.xx] 형식을 지원
const parseLRC = (lrcText: string): { time: number; text: string }[] => {
  const lines = lrcText.split("\n");
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;
  const result = [];

  for (const line of lines) {
    const match = regex.exec(line);
    if (match) {
      const [, min, sec, ms = "0", text] = match;
      const time =
        parseInt(min) * 60 + parseInt(sec) + parseInt(ms.padEnd(3, "0")) / 1000;
      result.push({ time, text: text.trim() });
    }
  }

  return result;
};

const MP3LyricsPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("");

  // LRC 파일 불러오기
  useEffect(() => {
    fetch("/lyrics/sample.lrc") // public/lyrics/sample.lrc 경로에 저장된 파일
      .then((res) => res.text())
      .then((text) => {
        const parsed = parseLRC(text);
        setLyrics(parsed);
      });
  }, []);

  // 재생 시간에 따라 가사 추적
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = audioRef.current?.currentTime ?? 0;
      const current = [...lyrics]
        .reverse()
        .find((line) => currentTime >= line.time);
      if (current && current.text !== currentLyric) {
        setCurrentLyric(current.text);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [lyrics, currentLyric]);

  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
    }
  };

  return (
    <div className="text-center mt-8">
      <audio
        ref={audioRef}
        src="/audio/sample.mp3" // public/audio/sample.mp3 경로에 저장된 파일
        controls
        autoPlay
      />

      <h2 className="text-2xl font-bold mt-6 mb-4">{currentLyric}</h2>

      <div className="flex justify-center gap-4 mt-4">
        <button
          onClick={() => seekTo(5)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          ⏩ 5초로
        </button>
        <button
          onClick={() => seekTo(10)}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          ⏩ 10초로
        </button>
        <button
          onClick={() => seekTo(15)}
          className="bg-purple-500 text-white px-4 py-2 rounded"
        >
          ⏩ 15초로
        </button>
      </div>
    </div>
  );
};

export default MP3LyricsPlayer;
