import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Book Reading Project API",
      version: "1.0.0",
      description: "API documentation for the Book Reading Project authentication system",
    },
    servers: [
      {
        url: "http://localhost:3000", // <--- Make sure this matches your new port 3000
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        clientId: {
          type: "apiKey",
          in: "header",
          name: "x-client-id",
          description: "User ID required for authentication",
        },
      },
    },
  },
  // Fix the path: Use path.join to ensure it works on Windows and Linux
  // And look for both .ts and .js files
  apis: [
    path.join(__dirname, "../../src/routes/**/*.{ts,js}"), 
    path.join(__dirname, "../../src/models/**/*.{ts,js}")
  ], 
};

export const swaggerSpec = swaggerJsdoc(options);