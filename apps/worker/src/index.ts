export default {
  async fetch() {
    return Response.json({
      ok: true,
      service: "markitome-worker",
      TODO: "Add scheduled ingestion, R2 processing, and Vectorize indexing tasks here."
    });
  }
};
