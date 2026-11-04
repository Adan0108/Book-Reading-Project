// Explicit opt-in; never inherit the normal application's DB or email credentials.
export function configureQaEnvironment() {
  if (process.env.PUBLISHING_TEST_DATABASE !== "publishing_qa")
    throw new Error(
      "Integration fixtures require PUBLISHING_TEST_DATABASE=publishing_qa",
    );
  Object.assign(process.env, {
    MYSQL_HOST: "127.0.0.1",
    MYSQL_PORT: "3307",
    MYSQL_USER: "root",
    MYSQL_PASSWORD: "publishing-qa-local",
    MYSQL_DB: "publishing_qa",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "6379",
    EMAIL_HOST: "127.0.0.1",
    EMAIL_PORT: "1",
    EMAIL_SECURE: "false",
    EMAIL_USER: "",
    EMAIL_PASSWORD: "",
    EMAIL_FROM: "qa@example.invalid",
  });
}
