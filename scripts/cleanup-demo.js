import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV === 'production') throw new Error('Demo cleanup is disabled in production.');
if (process.env.AIRS_CLEAN_DEMO !== '1') throw new Error('Set AIRS_CLEAN_DEMO=1 to remove identifiable demo rows.');

const root = fileURLToPath(new URL('..', import.meta.url));
const databasePath = process.env.AIRS_DB_PATH || join(root, 'data', 'airs.sqlite');
const database = new DatabaseSync(databasePath);
database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');

const removed = {};
function remove(label, sql) {
  removed[label] = database.prepare(sql).run().changes;
}

try {
  remove('activity_request_reviews', "DELETE FROM activity_request_reviews WHERE request_id LIKE 'airs-demo-activity-%'");
  remove('activity_requests', "DELETE FROM activity_requests WHERE id LIKE 'airs-demo-activity-%'");
  remove('availability_requests', "DELETE FROM availability_requests WHERE id LIKE 'airs-demo-availability-%'");
  remove('audit_events', "DELETE FROM audit_events WHERE id LIKE 'airs-demo-audit-%'");
  remove('attendance_sessions', "DELETE FROM attendance_sessions WHERE id LIKE 'airs-demo-session-%'");
  remove('section_topic_progress', "DELETE FROM section_topic_progress WHERE section_id LIKE 'airs-demo-section-%'");
  remove('recovery_resources', "DELETE FROM recovery_resources WHERE id LIKE 'airs-demo-resource-%'");
  remove('schedule_items', "DELETE FROM schedule_items WHERE id LIKE 'airs-demo-schedule-%'");
  remove('enrollments', `DELETE FROM enrollments WHERE student_id LIKE 'airs-demo-student-%'
    OR section_id LIKE 'airs-demo-section-%'`);
  remove('missed_topics', "DELETE FROM missed_topics WHERE id LIKE 'airs-demo-missed-%'");
  remove('syllabus_topics', "DELETE FROM syllabus_topics WHERE id LIKE 'airs-demo-topic-%'");
  remove('syllabus_units', "DELETE FROM syllabus_units WHERE id LIKE 'airs-demo-unit-%'");
  remove('sections', "DELETE FROM sections WHERE id LIKE 'airs-demo-section-%'");
  remove('courses', "DELETE FROM courses WHERE id LIKE 'airs-demo-course-%'");
  remove('users', "DELETE FROM users WHERE email LIKE '%@demo.airs.local'");
  database.exec('COMMIT;');
  for (const [table, count] of Object.entries(removed)) console.log(`${table}: ${count} demo rows removed`);
} catch (error) {
  database.exec('ROLLBACK;');
  throw error;
} finally {
  database.close();
}