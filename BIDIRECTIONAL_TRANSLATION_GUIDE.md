# 🔄 Bidirectional Translation Architecture

**Requirement:** All content (posts, messages, case details, attorney profiles) displays in user's selected language automatically, regardless of original language.

---

## 📋 Architecture Overview

```
User A (English):
┌─────────────────────────────────────┐
│ Writes case: "Contract negotiation" │
│ Posts to platform                   │
└─────────────────────────────────────┘
         ↓ STORED IN DATABASE ↓
┌─────────────────────────────────────┐
│ Case Record:                        │
│ - original_text: "Contract negotiation" │
│ - original_language: "en"           │
│ - translations: {                   │
│     es: "Negociación de contrato"   │
│     fr: "Négociation de contrat"    │
│     zh: "合同谈判"                     │
│   }                                 │
└─────────────────────────────────────┘
         ↓
User B views in Spanish:
User C views in French:
User D views in Chinese:
         ↓
(All see the SAME content in their language)
```

---

## 🔧 Implementation Steps

### Step 1: Update Database Schema

```sql
-- Add translation fields to cases, messages, etc.
ALTER TABLE cases ADD COLUMN (
  original_language VARCHAR(5) DEFAULT 'en',
  translated_content JSONB DEFAULT '{}'
);

-- Example: translated_content
{
  "es": {
    "description": "Demanda por despido injustificado...",
    "title": "Reclamación de terminación injusta"
  },
  "fr": {
    "description": "Réclamation de résiliation abusive...",
    "title": "Réclamation pour licenciement injustifié"
  },
  "zh": {
    "description": "不公正解雇索赔...",
    "title": "不公正解雇索赔"
  }
}
```

### Step 2: Create Translation Service

```typescript
// transcend-api/src/services/contentTranslationService.ts

interface TranslatableContent {
  id: string;
  originalLanguage: string;
  fields: {
    [fieldName: string]: string; // e.g., title, description, content
  };
}

interface TranslatedContent {
  [language: string]: {
    [fieldName: string]: string;
  };
}

export async function translateContent(
  content: TranslatableContent,
  targetLanguages: string[]
): Promise<TranslatedContent> {
  const results: TranslatedContent = {};

  for (const lang of targetLanguages) {
    if (lang === content.originalLanguage) {
      // No need to translate if already in target language
      results[lang] = content.fields;
      continue;
    }

    // Batch translate all fields for this language
    const translations = await translateBatch(
      Object.values(content.fields),
      lang
    );

    results[lang] = {};
    Object.keys(content.fields).forEach((fieldName, index) => {
      results[lang][fieldName] = Object.values(translations)[index];
    });
  }

  return results;
}
```

### Step 3: Update API Endpoints

**When creating content (case, message, post):**

```typescript
// POST /api/v2/cases/create
app.post('/api/v2/cases/create', async (req, res) => {
  const { title, description, userId, language = 'en' } = req.body;

  // Save original
  const caseRecord = {
    id: generateId(),
    userId,
    title,
    description,
    originalLanguage: language,
    translatedContent: {},
  };

  // Translate to top 10 languages
  const targetLanguages = ['es', 'fr', 'de', 'pt', 'zh', 'ja', 'ar', 'hi', 'vi', 'th'];
  
  const translations = await translateContent(
    {
      id: caseRecord.id,
      originalLanguage: language,
      fields: { title, description },
    },
    targetLanguages
  );

  caseRecord.translatedContent = translations;

  // Save to database
  await db.cases.insert(caseRecord);

  return res.json({ caseId: caseRecord.id, success: true });
});
```

**When retrieving content for user:**

```typescript
// GET /api/v2/cases/:caseId
app.get('/api/v2/cases/:caseId', async (req, res) => {
  const { caseId } = req.params;
  const { userLanguage } = req.query; // e.g., 'es', 'fr', 'zh'

  const caseRecord = await db.cases.findById(caseId);

  // Get content in user's language
  const content = userLanguage && caseRecord.translatedContent[userLanguage]
    ? caseRecord.translatedContent[userLanguage]
    : { title: caseRecord.title, description: caseRecord.description };

  return res.json({
    id: caseRecord.id,
    ...content,
    displayLanguage: userLanguage || caseRecord.originalLanguage,
    availableLanguages: Object.keys(caseRecord.translatedContent),
  });
});
```

### Step 4: Update Frontend

```typescript
// transcend-frontend/src/hooks/useTranslatedContent.ts

import { useLanguage } from '../context/LanguageContext';

export function useTranslatedContent(content: any) {
  const { language } = useLanguage();

  // Content automatically displays in user's language
  return {
    ...content,
    title: content.translatedContent?.[language]?.title || content.title,
    description: content.translatedContent?.[language]?.description || content.description,
  };
}

// Usage in components:
// <CaseCard case={useTranslatedContent(caseData)} />
// ↑ Automatically shows case in user's selected language
```

### Step 5: Handle Messages & Chat

```typescript
// Real-time message translation
interface Message {
  id: string;
  senderId: string;
  content: string;
  senderLanguage: string;
  translations: {
    [language: string]: string;
  };
  timestamp: Date;
}

// When message is sent:
async function sendMessage(content: string, senderId: string, recipientId: string) {
  const sender = await db.users.findById(senderId);
  const recipient = await db.users.findById(recipientId);

  // Translate to recipient's language immediately
  const translatedContent = await translateText(content, recipient.preferredLanguage);

  const message = {
    id: generateId(),
    senderId,
    content, // Original
    senderLanguage: sender.preferredLanguage,
    translations: {
      [recipient.preferredLanguage]: translatedContent,
    },
    timestamp: new Date(),
  };

  await db.messages.insert(message);

  // Send notification in recipient's language
  await sendNotification(recipient.email, {
    title: await translateText('New message', recipient.preferredLanguage),
    body: translatedContent.substring(0, 100),
  });
}
```

---

## 🎯 User Experience Flow

### When Client Submits Case (English):
```
Client: "I was wrongfully terminated"
         ↓
Backend: Translates to 10 languages
         ↓
Database: Stores original + 10 translations
```

### When Attorney Views (Spanish preference):
```
Attorney: Clicks "Cases" → Sees in Spanish
         ↓
API: Retrieves case in Spanish
         ↓
Display: "Fui terminado injustamente"
```

### When Different Attorney Views (Chinese preference):
```
Attorney: Same case → Sees in Chinese
         ↓
API: Retrieves same case in Chinese
         ↓
Display: "我被不公正地解雇了"
```

---

## 💰 Performance Optimization

### Caching Strategy

```typescript
// Cache translated content at multiple levels:

// Level 1: Browser Cache (1 hour)
localStorage.setItem(
  `case_${caseId}_${language}`,
  JSON.stringify(translatedContent)
);

// Level 2: API Response Cache (Redis, 24 hours)
await redis.set(
  `case:${caseId}:${language}`,
  JSON.stringify(translatedContent),
  { EX: 86400 }
);

// Level 3: Database (persistent)
// Stored in translatedContent JSONB field
```

### Lazy Translation

```typescript
// Don't translate everything upfront - only top 5 languages
const priorityLanguages = ['es', 'fr', 'zh', 'ja', 'ar'];

// Translate on demand for less common languages
const getLazyTranslation = async (contentId, targetLanguage) => {
  // Check cache first
  const cached = await redis.get(`content:${contentId}:${targetLanguage}`);
  if (cached) return JSON.parse(cached);

  // Translate on demand
  const translation = await translateText(originalContent, targetLanguage);
  
  // Cache for future requests
  await redis.set(`content:${contentId}:${targetLanguage}`, translation, { EX: 604800 });
  
  return translation;
};
```

---

## 🔐 Quality Assurance

### Language Detection

```typescript
// Auto-detect original language if not specified
import { detect } from 'detect-language-library';

const detectedLanguage = await detect(content);
// Returns: 'en', 'es', 'fr', etc.
```

### Translation Fallbacks

```typescript
// If translation fails, show original with language indicator
{
  title: originalTitle,
  description: originalDescription,
  language: 'en',
  note: '⚠️ Translation unavailable - showing original English'
}
```

### Accuracy Validation

```typescript
// QA: Compare original and back-translation
const original = "I need legal help";
const translated = await translateText(original, 'es'); // "Necesito ayuda legal"
const backTranslated = await translateText(translated, 'en'); // "I need legal help"

// Validate similarity
const similarity = calculateSimilarity(original, backTranslated);
if (similarity < 0.85) {
  console.warn('Translation quality low for:', original);
}
```

---

## 📊 Cost Analysis

| Task | Cost |
|------|------|
| Translate 1 case (10 languages) | $0.02 |
| Translate 100 messages | $0.05 |
| Monthly (1000 cases, 10k messages) | $50-100 |

**Recommendation:** Use Google Translate API for cost, DeepL for quality.

---

## ✅ Deployment Checklist

- [ ] Database schema updated with translation fields
- [ ] Redis cache configured
- [ ] Translation service created (contentTranslationService.ts)
- [ ] API endpoints updated to support user language preference
- [ ] Frontend hooked to display translated content
- [ ] Message translation implemented for chat
- [ ] Language detection setup (fallback to English)
- [ ] Back-translation QA process
- [ ] Rate limiting on translation endpoints
- [ ] Monitoring for translation failures
- [ ] Documentation updated
- [ ] Tested with all 16+ languages

---

## 🚀 Result

**Before (without bidirectional translation):**
- Client posts in English → Attorney sees English even if they prefer Spanish

**After (with bidirectional translation):**
- Client posts in English → Attorney automatically sees Spanish
- Client in China → Sees everything in Chinese
- Everyone communicates effectively in their language
- **True global platform**

