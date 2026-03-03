import { Component, ElementRef, EventEmitter, Output, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'otp-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './otp-input.html',
  styleUrl: './otp-input.css',
})
export class OtpInput {
  @Output() completed = new EventEmitter<string>();
  @ViewChildren('otpBox') otpBoxes!: QueryList<ElementRef<HTMLInputElement>>;

  digits: string[] = ['', '', '', '', '', ''];

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');

    if (value.length > 1) {
      // Handle paste of multiple digits into a single box
      const chars = value.split('').slice(0, 6 - index);
      chars.forEach((char, i) => {
        if (index + i < 6) {
          this.digits[index + i] = char;
        }
      });
      this.syncInputs();
      const nextIndex = Math.min(index + chars.length, 5);
      this.focusBox(nextIndex);
      this.checkComplete();
      return;
    }

    this.digits[index] = value;

    if (value && index < 5) {
      this.focusBox(index + 1);
    }

    this.checkComplete();
  }

  onKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      if (!this.digits[index] && index > 0) {
        this.digits[index - 1] = '';
        this.focusBox(index - 1);
        event.preventDefault();
      } else {
        this.digits[index] = '';
      }
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      this.focusBox(index - 1);
      event.preventDefault();
    }

    if (event.key === 'ArrowRight' && index < 5) {
      this.focusBox(index + 1);
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);

    if (pasted.length === 0) return;

    pasted.split('').forEach((char, i) => {
      if (i < 6) this.digits[i] = char;
    });

    this.syncInputs();
    this.focusBox(Math.min(pasted.length, 5));
    this.checkComplete();
  }

  private focusBox(index: number) {
    const boxes = this.otpBoxes?.toArray();
    if (boxes && boxes[index]) {
      boxes[index].nativeElement.focus();
    }
  }

  private syncInputs() {
    const boxes = this.otpBoxes?.toArray();
    if (boxes) {
      boxes.forEach((box, i) => {
        box.nativeElement.value = this.digits[i];
      });
    }
  }

  private checkComplete() {
    const code = this.digits.join('');
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      this.completed.emit(code);
    }
  }

  reset() {
    this.digits = ['', '', '', '', '', ''];
    this.syncInputs();
    this.focusBox(0);
  }
}
