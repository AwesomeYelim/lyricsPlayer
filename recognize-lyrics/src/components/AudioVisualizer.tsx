import React, { useEffect, useState } from "react";
import ThreeVisualizer from "./ThreeVisualizer";
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const songLyrics = [
  "의지했던 모든 것 변해가고\n억울한 마음은 커져가네",
  "부끄럼 없이 살고 싶은 맘\n주님 아시네",
  "모든 일을 선으로 이겨내고\n죄의 유혹을 따르지 않네",
  "나를 구원하신 영원한 그 사랑\n크신 그 은혜 날 붙드시네",
  "주어진 내 삶이 작게만 보여도\n선하신 주 나를 이끄심 보네",
  "중심을 보시는 주님만 따르네\n날 택하신 주만 의지해",
  "보이는 상황에 무너질지라도\n예수 능력이 나를 붙드네",
  "보이지 않아도 주님만 따르네\n내 평생 주님을 노래하리라",
  "모든 일을 선으로 이겨내고\n죄의 유혹을 따르지 않네",
  "나를 구원하신 영원한 그 사랑\n크신 그 은혜 날 붙드시네",
  "주어진 내 삶이 작게만 보여도\n선하신 주 나를 이끄심 보네",
  "중심을 보시는 주님만 따르네\n날 택하신 주만 의지해",
  "보이는 상황에 무너질지라도\n예수 능력이 나를 붙드네",
  "보이지 않아도 주님만 따르네\n내 평생 주님을 노래하리라",
];

const AudioVisualizer: React.FC = () => {
  const [lyrics, setLyrics] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState<number>(0);

  useEffect(() => {
    const recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!recognition) {
      console.error("SpeechRecognition API is not supported in this browser.");
      return;
    }

    const recognitionInstance = new recognition();
    recognitionInstance.lang = "ko-KR";
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;

    recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.resultIndex][0].transcript;
      console.log("Recognized speech:", transcript);

      const matchedLine = songLyrics.findIndex((line) =>
        line.includes(transcript)
      );

      if (matchedLine !== -1) {
        setLyrics([songLyrics[matchedLine]]);
        setCurrentLine(matchedLine);
      }
    };

    recognitionInstance.start();
  }, [currentLine]);

  return (
    <div>
      <ThreeVisualizer />
      <div
        style={{
          position: "absolute",
          width: "70%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "white",
          fontSize: "5rem",
          fontWeight: "bold",
          fontFamily: "Nanum, sans-serif",
          textAlign: "center",
          lineHeight: "1.5",
        }}
      >
        {lyrics.map((line, index) => (
          <p
            style={{
              whiteSpace: "pre-line",
            }}
            key={index}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
};

export default AudioVisualizer;
