
import client from '../../lib/mongodb';

export default async function handler(req, res) {
  try {
    await client.connect();
    const db = client.db('nixicon'); // Change to your DB name if different
    // Example: get a list of collections
    const collections = await db.listCollections().toArray();
    res.status(200).json({ collections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
