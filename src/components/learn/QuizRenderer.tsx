import React from 'react';
import { QuizQuestion } from '../../types';
import QuizMCQ from './QuizMCQ';
import QuizTrueFalse from './QuizTrueFalse';
import QuizImageMCQ from './QuizImageMCQ';
import QuizMatch from './QuizMatch';
import QuizSequence from './QuizSequence';

interface Props {
  question: QuizQuestion;
  onAnswer: (correct: boolean) => void;
}

export default function QuizRenderer({ question, onAnswer }: Props) {
  switch (question.type) {
    case 'mcq':
      return <QuizMCQ question={question} onAnswer={onAnswer} />;
    case 'truefalse':
      return <QuizTrueFalse question={question} onAnswer={onAnswer} />;
    case 'image_mcq':
      return <QuizImageMCQ question={question} onAnswer={onAnswer} />;
    case 'match':
      return <QuizMatch question={question} onAnswer={onAnswer} />;
    case 'sequence':
      return <QuizSequence question={question} onAnswer={onAnswer} />;
  }
}
