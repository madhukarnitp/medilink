const { success, error } = require('../utils/apiResponse');

const MAX_HISTORY = 10;
const MAX_MESSAGE_LENGTH = 1200;

const emergencyPattern =
  /\b(chest pain|can't breathe|cannot breathe|difficulty breathing|stroke|seizure|unconscious|severe bleeding|suicide|self harm|poison|overdose|heart attack)\b/i;

const systemPrompt = `
You are MediBot, a careful health information assistant inside MediLink.
Give concise, practical, plain-language answers.
You can explain symptoms, medicines, first-aid basics, appointment preparation, and how to use MediLink.
Do not diagnose, prescribe, or replace a doctor.
For urgent red-flag symptoms, tell the user to use SOS/emergency services immediately.
When the question needs personal medical judgment, advise booking a doctor consultation.
`.trim();

exports.medibotChat = async (req, res, next) => {
  try {
    const message = sanitizeMessage(req.body?.message);
    if (!message) return error(res, 'Message is required', 400);

    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-MAX_HISTORY).map(normalizeHistoryItem).filter(Boolean)
      : [];
    const userContext = {
      name: req.user?.name || '',
      role: req.user?.role || 'user',
    };

    if (emergencyPattern.test(message)) {
      return success(res, {
        answer:
          'This may be urgent. Please use the SOS Emergency button or call local emergency services now. If you are with the patient, keep them still, do not delay care, and share your live location with a trusted contact.',
        source: 'safety',
      });
    }

    const aiAnswer = await getAiAnswer({ history, message, userContext });
    if (aiAnswer) {
      return success(res, { answer: aiAnswer, source: 'ai' });
    }

    return success(res, {
      answer: getFallbackAnswer(message),
      source: 'fallback',
    });
  } catch (err) {
    next(err);
  }
};

function sanitizeMessage(value) {
  return String(value || '').trim().slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeHistoryItem(item) {
  const role = item?.role === 'user' ? 'user' : item?.role === 'bot' || item?.role === 'assistant' ? 'assistant' : '';
  const content = sanitizeMessage(item?.text || item?.content);
  if (!role || !content) return null;
  return { role, content };
}

async function getAiAnswer({ history, message, userContext }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey || typeof fetch !== 'function') return '';

  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'system',
      content: `User context: role=${userContext.role}; name=${userContext.name || 'not provided'}.`,
    },
    ...history,
    { role: 'user', content: message },
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
        max_tokens: 420,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn(`[medibot] AI provider failed: ${response.status} ${detail.slice(0, 180)}`);
      return '';
    }

    const data = await response.json();
    return String(data?.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    console.warn(`[medibot] AI provider unavailable: ${err.message}`);
    return '';
  }
}

function getFallbackAnswer(message) {
  const lower = message.toLowerCase();
  if (lower.includes('blood pressure') || lower.includes('bp')) {
    return 'For blood pressure, track readings at rest, reduce salt, stay active, sleep well, and avoid smoking. If readings stay above 140/90, or you have chest pain, weakness, severe headache, or breathlessness, seek medical care quickly.';
  }
  if (lower.includes('fever')) {
    return 'For fever, drink fluids, rest, and monitor temperature. Seek medical care for fever above 103°F, fever lasting more than 3 days, stiff neck, confusion, breathing trouble, rash, dehydration, or fever in a very young child.';
  }
  if (lower.includes('cold') || lower.includes('cough')) {
    return 'For common cold or cough, rest, fluids, steam/saline rinses, and symptom relief may help. See a doctor if symptoms last over 10 days, breathing is difficult, fever is high, or chest pain develops.';
  }
  if (lower.includes('medicine') || lower.includes('tablet') || lower.includes('dose')) {
    return 'I can explain general medicine information, but dose changes should come from a doctor or pharmacist. Share the medicine name, strength, age, and why it was prescribed, then confirm through a MediLink consultation for personal advice.';
  }
  if (lower.includes('appointment') || lower.includes('consult')) {
    return 'You can use MediLink Consult Doctor to choose a specialist, start a consultation, and share symptoms. For urgent symptoms, use SOS Emergency instead of waiting for chat.';
  }
  return 'I can help with general health information and MediLink guidance. For a personal diagnosis or treatment plan, please book a consultation with a verified doctor. If symptoms are severe or sudden, use SOS Emergency.';
}
