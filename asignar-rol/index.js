import { Client, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const users = new Users(client);

  try {
    const payload = req.bodyJson || (req.body ? JSON.parse(req.body) : {});
    const { userId, rol } = payload;

    if (!userId || !rol) {
      return res.json({ success: false, error: 'Faltan userId o rol.' }, 400);
    }

    await users.updateLabels(userId, [rol]);
    log(`Label "${rol}" asignado al usuario ${userId}`);

    return res.json({ success: true });
  } catch (err) {
    error(`Error al asignar label: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500);
  }
};