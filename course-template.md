# Course Information

Put course fields inside a JSON code block. Required fields: `titleAr`, `titleEn`, and `contentType`. `contentType` is `LIVE` or `RECORDED`; `level` is `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, or `ALL_LEVELS`.

```json
{
  "titleAr": "مقدمة في الأمن السيبراني",
  "titleEn": "Introduction to Cybersecurity",
  "excerptAr": "نبذة قصيرة",
  "excerptEn": "Short summary",
  "categoryAr": "الأمن السيبراني",
  "categoryEn": "Cybersecurity",
  "level": "BEGINNER",
  "contentType": "RECORDED",
  "language": "Arabic",
  "hoursOfContent": 2,
  "durationAr": "أسبوعان",
  "durationEn": "2 weeks",
  "syllabusAr": "",
  "syllabusEn": "",
  "coverImageUrl": "",
  "introVideoUrl": "",
  "videoFileUrl": "",
  "certificateIssued": true,
  "quizzesIncluded": false,
  "projectsIncluded": false,
  "assignmentsIncluded": false,
  "liveSessionsIncluded": false,
  "downloadableResources": false,
  "lifetimeAccess": false,
  "communityAccess": false
}
```

# Course Description

```json
{
  "descriptionAr": "الوصف التفصيلي بالعربية",
  "descriptionEn": "Full description in English",
  "syllabusAr": "المنهج بالعربية",
  "syllabusEn": "Syllabus in English"
}
```

# Learning Objectives

```json
[
  { "objectiveAr": "تحليل التنبيهات", "objectiveEn": "Analyze alerts", "orderIndex": 0 }
]
```

# Requirements

```json
[
  { "prerequisiteAr": "معرفة أساسية بالحاسب", "prerequisiteEn": "Basic computer knowledge", "orderIndex": 0 }
]
```

# Target Audience

```json
[
  { "audienceAr": "المبتدئون", "audienceEn": "Beginners", "orderIndex": 0 }
]
```

# Modules

```json
[
  {
    "importKey": "module-1",
    "titleAr": "مقدمة",
    "titleEn": "Introduction",
    "orderIndex": 0,
    "modules": [
      {
        "importKey": "lesson-1",
        "titleAr": "الدرس الأول",
        "titleEn": "Lesson 1",
        "descriptionAr": "محتوى الدرس",
        "descriptionEn": "Lesson content",
        "durationMinutes": 20,
        "orderIndex": 0,
        "outcomes": [],
        "files": [],
        "links": []
      }
    ]
  }
]
```

# Quizzes

The quiz types are `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, and `TRUE_FALSE`. Questions are stored inside each quiz. `moduleRef` must match a lesson `importKey` for a lesson quiz. A final course quiz uses `"isFinal": true` and does not need `moduleRef`.

```json
[
  {
    "quizKey": "quiz-1",
    "titleAr": "اختبار المقدمة",
    "titleEn": "Introduction Quiz",
    "passScore": 60,
    "isFinal": false,
    "moduleRef": "lesson-1",
    "orderIndex": 0,
    "questions": [
      {
        "type": "SINGLE_CHOICE",
        "textAr": "ما الهدف من المراقبة؟",
        "textEn": "What is the goal of monitoring?",
        "options": [
          { "textAr": "اكتشاف التهديدات", "textEn": "Detect threats" },
          { "textAr": "لا شيء", "textEn": "Nothing" }
        ],
        "correctIndex": 0,
        "orderIndex": 0
      }
    ]
  }
]
```

# Questions

Questions belong to quizzes and are entered in each quiz's `questions` array.

# Resources

Attach resources to lessons using `lessonKey`, which must match a lesson `importKey`. `type` is `FILE` or `LINK`. URLs must use HTTP(S) or a safe `/uploads/` path.

```json
[
  {
    "lessonKey": "lesson-1",
    "type": "LINK",
    "url": "https://example.com",
    "labelAr": "مرجع الدرس",
    "labelEn": "Lesson reference"
  }
]
```

# FAQs

```json
[]
```
# Gallery

```json
[]
```
