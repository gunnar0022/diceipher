import { motion } from 'framer-motion';

interface Props {
  phrase: string;
  revealedIndices: number[];
  onReveal: (index: number) => void;
}

export default function PhraseDisplay({ phrase, revealedIndices, onReveal }: Props) {
  const words: { char: string; index: number; isLetter: boolean }[][] = [];
  let currentWord: typeof words[0] = [];

  for (let i = 0; i < phrase.length; i++) {
    const char = phrase[i];
    if (char === ' ') {
      if (currentWord.length > 0) {
        words.push(currentWord);
        currentWord = [];
      }
    } else {
      const isLetter = /[a-zA-Z0-9]/.test(char);
      currentWord.push({ char, index: i, isLetter });
    }
  }
  if (currentWord.length > 0) words.push(currentWord);

  const totalChars = phrase.length;
  let fontSize = 72;
  if (totalChars > 40) fontSize = 56;
  if (totalChars > 60) fontSize = 44;
  if (totalChars > 80) fontSize = 36;

  const tileSize = fontSize * 1.15;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
      gap: '12px 24px', padding: '20px',
    }}>
      {words.map((word, wi) => (
        <div key={wi} style={{ display: 'flex', gap: 4 }}>
          {word.map(({ char, index, isLetter }) => {
            const revealed = revealedIndices.includes(index);

            if (!isLetter) {
              return (
                <div key={index} style={{
                  width: tileSize * 0.5, height: tileSize, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize, fontWeight: 800, color: '#064E3B',
                }}>
                  {char}
                </div>
              );
            }

            return (
              <motion.div
                key={index}
                onClick={() => !revealed && onReveal(index)}
                whileHover={!revealed ? { scale: 1.05 } : {}}
                whileTap={!revealed ? { scale: 0.95 } : {}}
                style={{
                  width: tileSize, height: tileSize, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize, fontWeight: 800, cursor: revealed ? 'default' : 'pointer',
                  background: revealed ? '#059669' : '#34D399',
                  color: '#F0FDF4',
                  userSelect: 'none',
                  boxShadow: revealed
                    ? '0 2px 10px rgba(5,150,105,0.35)'
                    : '0 2px 6px rgba(52,211,153,0.3)',
                  border: revealed ? '2px solid #047857' : '2px solid #6EE7B7',
                }}
              >
                {revealed ? (
                  <motion.span
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    {char.toUpperCase()}
                  </motion.span>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
