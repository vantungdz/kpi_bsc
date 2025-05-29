import { Controller, Post, Body } from '@nestjs/common';
import axios from 'axios';

@Controller('gemini')
export class GeminiController {
  @Post('chat')
  async chatWithGemini(@Body('message') message: string) {
    const GEMINI_API_KEY = 'AIzaSyAjImxvly4RSDyafz9qLB5QhX-hpiiBY34'; // <-- Thay bằng API key Gemini của bạn

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: message }] }],
        },
      );
      return {
        text:
          response.data.candidates &&
          response.data.candidates[0] &&
          response.data.candidates[0].content &&
          response.data.candidates[0].content.parts &&
          response.data.candidates[0].content.parts[0] &&
          response.data.candidates[0].content.parts[0].text
            ? response.data.candidates[0].content.parts[0].text
            : 'No response from Gemini',
      };
    } catch (e) {
      console.error('Gemini API error:', e?.response?.data || e?.message || e);
      return { text: 'Error contacting Gemini API' };
    }
  }
}
