import { GoogleGenAI } from "@google/genai";
import { Layer, Shape } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMeasurements = async (layers: Layer[], shapes: Shape[]): Promise<string> => {
  // Aggregate data for the prompt
  const reportData = layers.map(layer => {
    const layerShapes = shapes.filter(s => s.layerId === layer.id);
    const total = layerShapes.reduce((sum, shape) => sum + shape.measuredValue, 0);
    return {
      layerName: layer.name,
      type: layer.type === 'surface' ? 'Surface Area' : 'Linear Length',
      totalValue: total.toFixed(2),
      unit: layer.type === 'surface' ? 'm²' : 'm',
      itemCount: layerShapes.length
    };
  });

  const prompt = `
    Tu es un assistant expert en bâtiment et travaux publics (BTP).
    Voici un relevé de métrés réalisé sur un plan :

    ${JSON.stringify(reportData, null, 2)}

    Pour chaque calque (Layer), analyse les besoins potentiels.
    1. Fais un résumé professionnel des quantités.
    2. Suggère des matériaux ou des fournitures typiques nécessaires (ex: litres de peinture pour une surface murale, ml de plinthes pour un périmètre).
    3. Si possible, donne une estimation "à la louche" de la complexité.

    Réponds en format Markdown, clair et concis, en français.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "Tu es un expert en métré et estimation de travaux.",
        thinkingConfig: { thinkingBudget: 0 } // Fast response needed
      }
    });

    return response.text || "Désolé, je n'ai pas pu générer l'analyse.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Une erreur est survenue lors de l'analyse avec Gemini. Vérifiez votre clé API.";
  }
};