import { WORDS } from './words';
import {
  Component,
  ElementRef,
  HostListener,
  QueryList,
  ViewChildren,
} from '@angular/core';

const WORD_LENGTH = 5; //Length of the word
const NUM_TRIES = 7; // Number of tries

//Letter Map
const LETTERS = (() => {
  const ret: { [key: string]: boolean } = {};

  for (let i = 97; i < 97 + 26; i++) {
    ret[String.fromCharCode(i)] = true;
  }
  return ret;
})();

// First Try
interface Try {
  letters: Letter[];
}

// One Letter in a try
interface Letter {
  text: string;
  state: LetterState;
}

//
enum LetterState {
  WRONG,
  PARTIAL_MATCH,
  FULL_MATCH,
  PENDING,
}

@Component({
  selector: 'Wordle',
  templateUrl: './wordle.component.html',
  styleUrls: ['./wordle.component.scss'],
})
export class Wordle {
  @ViewChildren('tryContainer') tryContainers!: QueryList<ElementRef>;

  // Stores all tries.
  // One try is one row in the UI
  readonly tries: Try[] = [];

  // This is to make LetterState enum accessible in html template
  readonly LetterState = LetterState;

  // Keyboard rows.
  readonly keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
  ];

  // Stores the state for the keyboard key indexed by keys.
  readonly currLetterStates: { [key: string]: LetterState } = {};

  // Message shown in the message panel
  infoMsg = '';

  // Controls info message fading out animation
  fadeOutInfoMessage = false;

  showShareDialogContainer = false;
  showShareDialog = false;

  private currLetterIndex = 0;

  //Tracks the number of submitted tries
  private numSubmittedTries = 0;

  // Store the target word.
  private targetWord = '';

  // Won or not!
  private won = false;

  // Stores the count for each letter from the target word.
  // Example if a target word is 'happy' then the map will be:
  // { 'h': 1, 'a': 1, 'p': 2, 'y': 1 }
  private targetWordLetterCounts: { [letter: string]: number } = {};

  constructor() {
    for (let i = 0; i < NUM_TRIES; i++) {
      const letters: Letter[] = [];
      for (let j = 0; j < WORD_LENGTH; j++) {
        letters.push({
          text: '',
          state: LetterState.PENDING,
        });
      }
      this.tries.push({ letters }); // push a new try object into the tries array
    }

    // Get a target word from WORDLIST
    const numWords = WORDS.length;
    while (true) {
      //Randomly select a word and check if its length is equal to WORD_LENGTH
      const index = Math.floor(Math.random() * numWords);
      const word = WORDS[index];
      if (word.length === WORD_LENGTH) {
        this.targetWord = word.toLowerCase();
        break;
      }
    }

    // For cheating, uncomment this line to show the target word
    console.log('Target word: ', this.targetWord);

    // Generate letter counts for the target word
    for (const letter of this.targetWord) {
      const count = this.targetWordLetterCounts[letter];
      if (count == null) {
        this.targetWordLetterCounts[letter] = 0;
      }
      this.targetWordLetterCounts[letter]++;
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydownEvent(event: KeyboardEvent) {
    this.handleClickKey(event.key);
  }

  // Returns the classes for the given keyboard key based on its state
  getKeyClass(key: string): string {
    const state = this.currLetterStates[key.toLowerCase()];
    switch (state) {
      case LetterState.WRONG:
        return 'wrong key';
      case LetterState.PARTIAL_MATCH:
        return 'partial key';
      case LetterState.FULL_MATCH:
        return 'match key';
      default:
        return 'key';
    }
  }

  handleClickKey(key: string) {
    // Don't handle keydown events when user has won the game
    if (this.won) return;

    //If key is a letter, update the text in the corresponding letter letter object.
    if (LETTERS[key.toLowerCase()]) {
      if (this.currLetterIndex < (this.numSubmittedTries + 1) * WORD_LENGTH) {
        this.setLetter(key);
        this.currLetterIndex++;
      }
    }
    // handle Delete
    else if (key === 'Backspace') {
      //Don't delete previous try
      if (this.currLetterIndex > this.numSubmittedTries * WORD_LENGTH) {
        this.currLetterIndex--;
        this.setLetter('');
      }
    }

    // handle Enter
    else if (key === 'Enter') {
      this.checkCurrentTry();
    }
  }

  handleClickShare() {
    // 🟩🟨⬜
    // Copy results into clipboard.
    let clipboardContent = '';
    for (let i = 0; i < this.numSubmittedTries; i++) {
      for (let j = 0; j < WORD_LENGTH; j++) {
        const letter = this.tries[i].letters[j];
        switch (letter.state) {
          case LetterState.FULL_MATCH:
            clipboardContent += '🟩';
            break;
          case LetterState.PARTIAL_MATCH:
            clipboardContent += '🟨';
            break;
          case LetterState.WRONG:
            clipboardContent += '⬜';
            break;
          default:
            break;
        }
      }
      clipboardContent += '\n';
    }
    console.log(clipboardContent);
    navigator.clipboard.writeText(clipboardContent);
    this.showShareDialogContainer = false;
    this.showShareDialog = false;
    this.showInfoMessage('Copied results to clipboard');
  }

  private setLetter(letter: string) {
    const tryIndex = Math.floor(this.currLetterIndex / WORD_LENGTH);
    const letterIndex = this.currLetterIndex - tryIndex * WORD_LENGTH;
    this.tries[tryIndex].letters[letterIndex].text = letter;
  }

  private async checkCurrentTry() {
    // Check if user has typed all the letters
    const currTry = this.tries[this.numSubmittedTries];
    if (currTry.letters.some((letter) => letter.text === '')) {
      this.showInfoMessage('Please type all the letters');
      return;
    }

    // Check if user has typed the correct word
    const wordFromCurTry = currTry.letters
      .map((letter) => letter.text)
      .join('')
      .toUpperCase();

    if (!WORDS.includes(wordFromCurTry)) {
      this.showInfoMessage('Not in word list');

      // Shake the current row
      const tryContainer = this.tryContainers.get(this.numSubmittedTries)
        ?.nativeElement as HTMLElement;
      tryContainer.classList.add('shake');
      setTimeout(() => {
        tryContainer.classList.remove('shake');
      }, 500);
      return;
    }

    // Check if the current Try matches the target word.
    // stores the check results.

    // Clones the counts map. Need to use it in every check with the initial values.
    const targetWordLetterCounts = { ...this.targetWordLetterCounts };

    const states: LetterState[] = [];

    for (let i = 0; i < WORD_LENGTH; i++) {
      const expected = this.targetWord[i];
      const curLetter = currTry.letters[i];
      const got = curLetter.text.toLowerCase();
      let state = LetterState.WRONG;

      // Need to make sure only performs the check when the letter has been checked before.
      if (got === expected && targetWordLetterCounts[got] > 0) {
        targetWordLetterCounts[expected]--;
        state = LetterState.FULL_MATCH;
      } else if (
        this.targetWord.includes(got) &&
        targetWordLetterCounts[got] > 0
      ) {
        targetWordLetterCounts[got]--;
        state = LetterState.PARTIAL_MATCH;
      }
      states.push(state);
    }

    // Animation

    //Get the current Try
    const tryContainer = this.tryContainers.get(this.numSubmittedTries)
      ?.nativeElement as HTMLElement;

    //Get the letter elements
    const letterEles = tryContainer.querySelectorAll('.letter-container');

    for (let i = 0; i < letterEles.length; i++) {
      // Fold the letter, apply the resilt and update the style, then unfold the letter.
      const currLetterEle = letterEles[i];
      currLetterEle.classList.add('fold');

      // Wait for the fold animation to finish
      await this.wait(180);
      // Update state. This will also update the style.
      currTry.letters[i].state = states[i];

      // Unfold the letter
      currLetterEle.classList.remove('fold');
      await this.wait(180);
    }

    // Save to keyboard key states
    // Do this after the current try has been submitted and the animation above is done.
    for (let i = 0; i < WORD_LENGTH; i++) {
      const curLetter = currTry.letters[i];
      const got = curLetter.text.toLowerCase();
      const curStoredState = this.currLetterStates[got];
      const targetState = states[i];

      // This allows override state with better result.
      if (curStoredState == null || curStoredState < targetState) {
        this.currLetterStates[got] = targetState;
      }
    }

    this.numSubmittedTries++;

    // Check if all the letters in current try are correct.
    if (states.every((state) => state === LetterState.FULL_MATCH)) {
      this.showInfoMessage('You win!');
      this.won = true;

      // Bounce Animation
      for (let i = 0; i < letterEles.length; i++) {
        const currLetterEle = letterEles[i];
        currLetterEle.classList.add('bounce');
        await this.wait(160);
      }
      this.showShare();
      return;
    }

    // Running out of tries. Show correct word.
    if (this.numSubmittedTries === NUM_TRIES) {
      // Dont hide it
      this.showInfoMessage(this.targetWord.toUpperCase(), false);
      this.showShare();
    }
  }

  private showInfoMessage(msg: string, hide = true) {
    this.infoMsg = msg;

    if (hide) {
      // Hide after 2 seconds
      setTimeout(() => {
        this.fadeOutInfoMessage = true;

        //Reset when animation is done
        setTimeout(() => {
          this.infoMsg = '';
          this.fadeOutInfoMessage = false;
        }, 500);
      }, 2000);
    }
  }

  private async wait(ms: number) {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  private showShare() {
    setTimeout(() => {
      this.showShareDialogContainer = true;

      setTimeout(() => {
        this.showShareDialog = true;
      });
    }, 1500);
  }
}
