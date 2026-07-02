import assert from "node:assert/strict";
import {
  buildExamMaterialPageStoragePath,
  buildSubmissionPageStoragePath,
  examMaterialBucket,
  isLocalUploadReference,
  submissionsBucket,
} from "./upload-storage-paths";

const examPath = buildExamMaterialPageStoragePath({
  examId: "exam1",
  pageNumber: 1,
  extension: "jpg",
  uuid: "550e8400",
});
const submissionPath = buildSubmissionPageStoragePath({
  examId: "exam1",
  studentId: "student1",
  submissionId: "sub1",
  pageNumber: 1,
  extension: "jpg",
  uuid: "550e8400",
});

assert.equal(examMaterialBucket, "exam-materials");
assert.equal(submissionsBucket, "submissions");
assert.equal(examPath, "exam1/pages/page-1-550e8400.jpg");
assert.equal(submissionPath, "exam1/student1/sub1/pages/page-1-550e8400.jpg");
assert.equal(examPath.startsWith("exam-materials/"), false);
assert.equal(submissionPath.startsWith("submissions/"), false);
assert.equal(examPath.includes("public/uploads"), false);
assert.equal(submissionPath.includes("public/uploads"), false);
assert.equal(isLocalUploadReference("/uploads/submissions/old.jpg"), true);
assert.equal(isLocalUploadReference("public/uploads/exam-materials/old.jpg"), true);
assert.equal(isLocalUploadReference("submissions/exam1/student1/sub1/pages/old.jpg"), true);
assert.equal(isLocalUploadReference(submissionPath), false);

console.info("upload-storage self-check ok");
