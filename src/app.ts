import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import Xendit from "xendit-node";
import Express from "express";
import config from "./config";

const express = Express();

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {polling: true});

const xenditClient = new Xendit({
  secretKey: config.XENDIT_SECRET_KEY
});

const openai = new OpenAI({
  apiKey: config.OPEN_AI_API_KEY
});

type Chat = {
  role: "user" | "assistant" | "system";
  content: string;
}

type Invoice = {
  chatId: number;
  xenditInvoiceId?: string;
}

const messagesByChatId = {} as Record<number, Chat[]>;

const availableProducts = [
  {
    id: 1,
    name: "DORI GLZ 0%",
    price: 1000
  },
  {
    id: 2,
    name: "DORI GLZ 20%",
    price: 2000
  },
  {
    id: 3,
    name: "DORI GLZ 50-55%",
    price: 3000
  },
  {
    id: 4,
    name: "CUMI TUBE GLZ 40%",
    price: 4000
  },
  {
    id: 5,
    name: "SALMON FILLET",
    price: 5000
  },
  {
    id: 6,
    name: "UDANG HOSO",
    price: 6000
  },
  {
    id: 7,
    name: "UDANG PUD 500gr",
    price: 7000
  },
  {
    id: 8,
    name: "TILAPIA (1kg)",
    price: 8000
  },
  {
    id: 9,
    name: "FIB/CUCUT (1kg)",
    price: 9000
  },
] as Product[];

const availableLocations = [
  "Yogyakarta",
]

const invoices = [] as Invoice[];

type GroupOrder = {
  members: number[];
  minimumMemberToOrder: number;
}

const groupOrderByProduct = {
  1: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  2: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  3: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  4: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  5: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  6: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  7: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  8: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  },
  9: {
    members: [],
    minimumMemberToOrder: 10,
    discount: 0.4,
    closeOrderAt: "27-10-2024"
  }
} as {
  [productId: number]: GroupOrder
};




const generateXenditInvoice = async ({chatId, name, amount, items, phoneNumber}: any) => {
  const invoice = await xenditClient.Invoice.createInvoice({
    data: {
      amount,
      externalId: `${chatId}`,
      items: items,
      successRedirectUrl: `https://t.me/firmAi_bot?start=payment_success`,
      customer: {
        givenNames: name,
        phoneNumber,
      }
    },
  });
  invoices.push({
    chatId: chatId,
    xenditInvoiceId: invoice.id
  });
  return invoice;
}

type ChatReply = {
  message: string;
  options?: TelegramBot.SendMessageOptions;
}

const chat = async (msg: TelegramBot.Message, pushMessage: Boolean = true): Promise<ChatReply> => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const messages = messagesByChatId[chatId] || [];

  if(pushMessage) {
    messages.push({
      role: "user",
      content: `${text}`
    });
  }

  const completion = await openai.chat.completions.create({
    
    model: "gpt-4",
    messages: [
        { role: "system", content: `
Kamu adalah asisten yang membantu pelanggan memilih produk dari Frosala,
setelah memandu pengguna memilih produk, kamu harus menanyakan detail Nama, no hp, alamat, dan alamat sebelum melanjutkan ke pembayaran.
group order adalah pesanan bersama yang memungkinkan pembeli mendapatkan harga lebih murah dengan membeli dalam jumlah besar. untuk pesanan bersama, masing-masing peserta harus membayar pesanan mereka sendiri.
group order akan diproses jika kuota terpenuhi atau waktu pemesanan telah berakhir (refer: closeOrderAt).
group order adalah opsional, pengguna dapat memilih untuk membeli sendiri.
untuk pesanan group order, pesanan akan diproses jika kuota terpenuhi tapi harus membayar terlebih dahulu.
bershihkan keranjang setelah pembayaran selesai.
        ` },
        { 
          role: "system", content: `
            berikut adalah daftar constraint:
            available products: ${JSON.stringify(availableProducts)}
            alamat yang tersedia: ${JSON.stringify(availableLocations)}
            group order by product: ${JSON.stringify(groupOrderByProduct)}
            pengiriman ditanggung oleh pembeli
            Pengiriman produk pesanan mandiri diterima 1 hari setelah pembayaran diterima.
            Pengiriman produk pesanan bersama diterima 1-7 hari tergantung kuota terpenuhi.
            Jangan tanggapi pesan yang tidak relevan.
          `
        },
        ...messages
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "generate_xendit_invoice",
          description: "Generate Xendit invoice",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the customer",
              },
              amount: {
                type: "number",
                description: "Total amount",
              },
              items: {
                type: "array",
                description: "Array of items",
                items: {
                  type: "object",
                  description: "Items",
                  properties: {
                    name: {
                      type: "string",
                      description: "Name",
                    },
                    price: {
                      type: "number",
                      description: "Price",
                    },
                    quantity: {
                      type: "number",
                      description: "Quantity",
                    },
                  }
                }
              },
              phoneNumber: {
                type: "string",
                description: "Phone number",
              },
            }
          }
        }
      },
      // {
      //   type: "function",
      //   function: {
      //     name: "get_available_products",
      //     description: "Prompt select products if user wants to see available products",
      //     parameters: {
      //       type: "object",
      //       properties: {
      //         products: {
      //           type: "array",
      //           description: "Array of products",
      //           items: {
      //             type: "object",
      //             description: "Products",
      //             properties: {
      //               id: {
      //                 type: "number",
      //                 description: "ID",
      //               },
      //               name: {
      //                 type: "string",
      //                 description: "Name",
      //               },
      //               price: {
      //                 type: "number",
      //                 description: "Price",
      //               },
      //             }
      //           }
      //         },
      //         message: {
      //           type: "string",
      //           description: "Friendly message to user with little explanation",
      //         }
      //       }
      //     }
      //   }
      // }
    ]
  });
  const reply = completion.choices[0].message.content ?? "";

  if(completion.choices[0].message.tool_calls?.length) {
    const toolCall = completion.choices[0].message.tool_calls[0];
    if(toolCall.type === "function") {
      if(toolCall.function.name === "generate_xendit_invoice"){
        const args = JSON.parse(toolCall.function.arguments);
        const {amount, items, name, phoneNumber} = args;
        const invoice = await generateXenditInvoice({chatId, name, amount: amount, items, phoneNumber});
        const reply = `Invoice berhasil dibuat, silahkan klik link berikut untuk membayar: [Invoice](${invoice.invoiceUrl})`;
        messages.push({
          role: "assistant",
          content: reply
        });
        return {
          message: reply,
        };
      }
      if(toolCall.function.name === "get_available_products"){
        const args = JSON.parse(toolCall.function.arguments);
        const {products, message} = args;
        promptSelectProducts(msg);
        messages.push({
          role: "assistant",
          content: message
        });
        const options = {
          reply_markup: {
            inline_keyboard: products.map((product: any) => {
              return [
                {
                  text: product.name,
                  callback_data: `select|${product.id}`
                }
              ]
            })
          }
        } as TelegramBot.SendMessageOptions;
        return {
          message: message,
          options: options
        };
      }
    }
  }
  messages.push({
    role: "assistant",
    content: reply
  });

  messagesByChatId[chatId] = messages;
  return {
    message: reply
  };
}



type Product = {
  id: number;
  name: string;
  price: number;
}

const selectedProducts = [] as Product[];



const promptSelectProducts = (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Pilih produk", {
    reply_markup:{
      inline_keyboard: availableProducts.map((product) => {
        return [
          {
            text: product.name,
            callback_data: `select|${product.id}`
          }
        ]
      })
    }
  });
}

const app = () => {

  bot.onText(/\/start/, (msg) => {
    
  });

  bot.onText(/\/start payment_success/, async (msg) => {
    const chatId = msg.chat.id;
    const messages = messagesByChatId[chatId] || [];
    messages.push({
      role: "system",
      content: `
        Pembayaran berhasil, ucapkan terima kasih kepada pelanggan. Jika metode pesanan adalah group order, pesanan akan diproses setelah kuota terpenuhi.
        berikan link dengan format https://t.me/firmAi_bot?start=product,{product_id} untuk mengajak teman bergabung ke group order.
      `
    });
    messagesByChatId[chatId] = messages;
    const reply = await chat(msg, false);
    bot.sendMessage(chatId, reply.message, {
      parse_mode: "Markdown"
    });
  });
  

  bot.on("callback_query", (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message?.chat.id;
    if(!chatId) return;
    if(!data) return;

    const [command, value] = data.split("|");
    if(command === "select"){
      const product = availableProducts.find((product) => `${product.id}` == value);
      if(!product) return;
      selectedProducts.push(product);
      bot.sendMessage(chatId, `Kamu menambah ${product?.name} ke keranjang`, {
        reply_markup:{
          inline_keyboard: [
            [
              {
                text: "Lihat Keranjang",
                callback_data: "view_cart"
              }
            ]
          ]
        }
      });
    }
    if(command === "view_cart"){
      const total = selectedProducts.reduce((acc, product) => acc + product.price, 0);
      const groupedProducts = selectedProducts.reduce((acc, product) => {
        if(!acc[product.id]){
          acc[product.id] = {
            ...product,
            qty: 0
          }
        }
        acc[product.id].qty++;
        return acc;
      }, {} as Record<number, Product & {qty: number}>);

      const message = Object.values(groupedProducts).map((product) => {
        return `${product.name} - Rp ${product.price} x ${product.qty}`
      }).join("\n");

      bot.sendMessage(chatId, `Keranjang belanja kamu:\n${message}\nTotal: Rp ${total}`);

      if(callbackQuery.message?.message_id) {
        bot.deleteMessage(chatId, callbackQuery.message?.message_id);
      }
    }
  });

  bot.onText(/.*/, async (msg) => {
    if(msg.text?.startsWith("/")) return;
    const chatId = msg.chat.id;
    const reply = await chat(msg);
    const options = {
      parse_mode: "Markdown"
    } as TelegramBot.SendMessageOptions;

    if(reply.message.includes("[Invoice]")) {
      const invoiceUrl = reply.message.split("[Invoice](")[1].split(")")[0];
      options.reply_markup = {
        inline_keyboard: [
          [
            {
              text: "Invoice",
              url: invoiceUrl,
              pay: true,
            }
          ]
        ]
      }
    }

    bot.sendMessage(chatId, reply.message, options);

  });

  express.get("/webhook/xendit", async (req, res) => {
    const {external_id} = req.body;
    const invoice = invoices.find((invoice) => invoice.xenditInvoiceId === external_id);
    if(invoice) {
      const chatId = invoice.chatId;
      const messages = messagesByChatId[chatId] || [];
      messages.push({
        role: "assistant",
        content: "Pembayaran berhasil, pesanan kakak akan segera diproses"
      });
      messagesByChatId[chatId] = messages;
      res.send("OK");
    }
  });

}


express.listen(config.port, () => {
  console.log(`Server is running on ${config.host}:${config.port}`);
});




export default app;