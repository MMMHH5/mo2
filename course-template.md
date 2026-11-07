# Course Information

Put course fields inside the JSON code block. Required fields: `titleAr`, `titleEn`, and `contentType`. Use `LIVE` or `RECORDED` for `contentType`, and `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, or `ALL_LEVELS` for `level`.

```json
{
  "titleAr": "",
  "titleEn": "",
  "excerptAr": "",
  "excerptEn": "",
  "categoryAr": "",
  "categoryEn": "",
  "level": "",
  "contentType": "",
  "language": "",
  "hoursOfContent": "",
  "durationAr": "",
  "durationEn": "",
  "syllabusAr": "",
  "syllabusEn": "",
  "coverImageUrl": "",
  "introVideoUrl": "",
  "videoFileUrl": "",
  "certificateIssued": "",
  "quizzesIncluded": "",
  "projectsIncluded": "",
  "assignmentsIncluded": "",
  "liveSessionsIncluded": "",
  "downloadableResources": "",
  "lifetimeAccess": "",
  "communityAccess": ""
}
```

# Course Description

The description fields can also be supplied in the course information block above.

```json
{
  "descriptionAr": "",
  "descriptionEn": "",
  "syllabusAr": "",
  "syllabusEn": ""
}
```

# Learning Objectives

```json
[
  { "objectiveAr": "", "objectiveEn": "", "orderIndex": "" }
]
```

# Requirements

```json
[
  { "prerequisiteAr": "", "prerequisiteEn": "", "orderIndex": "" }
]
```

# Target Audience

```json
[
  { "audienceAr": "", "audienceEn": "", "orderIndex": "" }
]
```

# Modules

Each module is a chapter. Add lesson content, outcomes, files, and links inside its `modules` array. Use unique `importKey` values to connect lessons, quizzes, and resources.

```json
[
  {
    "importKey": "",
    "titleAr": "",
    "titleEn": "",
    "orderIndex": "",
    "modules": [
      {
        "importKey": "",
        "titleAr": "",
        "titleEn": "",
        "descriptionAr": "",
        "descriptionEn": "",
        "videoUrl": "",
        "durationMinutes": "",
        "orderIndex": "",
        "outcomes": [{ "descriptionAr": "", "descriptionEn": "", "orderIndex": "" }],
        "files": [{ "url": "", "nameAr": "", "nameEn": "" }],
        "links": [{ "url": "", "labelAr": "", "labelEn": "" }]
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
    "quizKey": "",
    "titleAr": "",
    "titleEn": "",
    "descriptionAr": "",
    "descriptionEn": "",
    "passScore": "",
    "isFinal": "",
    "moduleRef": "",
    "orderIndex": "",
    "questions": [
      {
        "type": "",
        "textAr": "",
        "textEn": "",
        "options": [{ "textAr": "", "textEn": "" }, { "textAr": "", "textEn": "" }],
        "correctIndex": "",
        "explanationAr": "",
        "explanationEn": "",
        "orderIndex": ""
      }
    ]
  }
]
```

# Questions

Questions belong to quizzes and are entered in each quiz's `questions` array above. Supported types are `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, and `TRUE_FALSE`. `correctIndex` is zero-based.

```json
[]
```

# Resources

Attach resources to lessons using `lessonKey`, which must match a lesson `importKey`. `type` is `FILE` or `LINK`. URLs must use HTTP(S) or a safe `/uploads/` path.

```json
[
  {
    "lessonKey": "",
    "type": "",
    "url": "",
    "nameAr": "",
    "nameEn": "",
    "labelAr": "",
    "labelEn": ""
  }
]
```

# FAQs

```json
[
  { "questionAr": "", "questionEn": "", "answerAr": "", "answerEn": "", "orderIndex": "" }
]
```

# Gallery

```json
[
  { "url": "", "altAr": "", "altEn": "", "orderIndex": "" }
]
```
