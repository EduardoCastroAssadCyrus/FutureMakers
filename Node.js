import bcrypt from 'bcrypt';
import express from 'express';
import session from 'express-session';
import { MongoClient } from 'mongodb';
import path from 'path';

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import bodyParser from "body-parser";
import cors from "cors";


import { dirname } from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);




const app = express();
const porta = 42069;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'bang-bang-banki-banki',
    resave: false,
    saveUninitialized: true,
}));
const urlMongo = 'mongodb://127.0.0.1:27017';
const nomeBanco = 'HDMI';
app.use(express.static(path.join(__dirname, 'public')));

app.get('/registrar', (req, res) => {
    res.sendFile(__dirname + '/registro.html');
});
app.post('/registrar', async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuarioExistente = await colecaousuarios.findOne({ usuario: req.body.usuario });
        if (usuarioExistente) {
            res.send(`
            <script>
                alert('Usuário já existe! Tente outro nome de usuário.');
                window.location.href = '/registrar';
            </script>
        `);
        } else {
            const senhaCriptografada = await bcrypt.hash(req.body.senha, 10);
            await colecaousuarios.insertOne({
                usuario: req.body.usuario,
                email: req.body.email,
                telefone: req.body.telefone,
                senha: senhaCriptografada,
                assinante: 0
            });
            res.redirect('/login');
        }
    } catch (erro) {
        res.send(`
            <script>
                alert('Ocorreu um erro ao registrar o usuário.');
                window.location.href = '/registrar';
            </script>
        `);
    } finally {
        cliente.close();
    }
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});
app.post('/login', async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.body.usuario });
        if (usuario && await bcrypt.compare(req.body.senha, usuario.senha)) {
            req.session.usuario = req.body.usuario;
            res.redirect('/contalogado');
        } else {
            res.redirect('/ErroLogin');
        }
    } catch (erro) {
        res.send(`
            <script>
                alert('Ocorreu um erro ao fazer login.');
                window.location.href = '/login';
            </script>
        `);
    } finally {
        cliente.close();
    }
});

function protegerRota(req, res, proximo) {
    if (req.session.usuario) {
        proximo();
    } else {
        res.redirect('/login');
    }
};

app.get('/Logout', (req, res) => {
    res.sendFile(__dirname + '/Logout.html');
});
app.post('/Logout', async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.body.usuario });
        if (usuario && await bcrypt.compare(req.body.senha, usuario.senha)) {
            req.session.destroy();
            res.send(`
            <script>
                alert('Você foi deslogado com  sucesso.');
                window.location.href = '/menu';
            </script>
        `);
        } else {
            res.redirect('/errodeletar');
        }
    } catch (erro) {
        res.send(`
        <script>
            alert('Erro ao excluir o usuário.');
            window.location.href = '/Logout';
        </script>
    `);
    } finally {
        cliente.close();
    }
});

app.get('/deleteuser', (req, res) => {
    res.sendFile(__dirname + '/DeletarUsuario.html');
});
app.post('/deleteuser', async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.body.usuario });
        if (usuario && await bcrypt.compare(req.body.senha, usuario.senha)) {

            await colecaousuarios.deleteOne({ usuario: req.body.usuario });
            res.send(`
          <script>
              alert('excluido com sucesso.');
              window.location.href = '/menu';
          </script>
      `);
            req.session.destroy();
        } else {
            res.redirect('/errodeletar');
        }
    } catch (erro) {
        res.send(`
        <script>
            alert('Erro ao excluir o usuário.');
            window.location.href = '/deleteuser';
        </script>
    `);
    } finally {
        cliente.close();
    }
});

app.get('/pospagamento', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.session.usuario });
        if (usuario) {
            await colecaousuarios.updateOne(
                { usuario: req.session.usuario },
                { $set: { assinante: 1 } }
            );
            res.sendFile(__dirname + '/PósPagamento.html');
        } else {
            res.redirect('/erro');
        }
    } catch (error) {
        res.send(`
            <script>
                alert('Erro ao pagar pelo usuario.');
                window.location.href = '/clonacartao';
            </script>
        `);
    } finally {
        await cliente.close();
    }
});

app.get('/contalogado', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/MinhaContaLogado.html');
});

app.get('/usuario', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.session.usuario });

        if (usuario) {
            res.json({
                usuario: usuario.usuario
            });
        } else {
            res.status(404).send('Usuário não encontrado.');
        }
    } catch (erro) {
        res.status(500).send('Erro ao buscar dados do usuário.');
    } finally {
        cliente.close();
    }
});
app.get('/email', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.session.usuario });

        if (usuario) {
            res.json({
                email: usuario.email
            });
        } else {
            res.status(404).send('Usuário não encontrado.');
        }
    } catch (erro) {
        res.status(500).send('Erro ao buscar dados do usuário.');
    } finally {
        cliente.close();
    }
});
app.get('/telefone', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.session.usuario });

        if (usuario) {
            res.json({
                telefone: usuario.telefone
            });
        } else {
            res.status(404).send('Usuário não encontrado.');
        }
    } catch (erro) {
        res.status(500).send('Erro ao buscar dados do usuário.');
    } finally {
        cliente.close();
    }
});
app.get('/assinante', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.session.usuario });

        if (usuario) {
            res.json({
                assinante: usuario.assinante
            });
        } else {
            res.status(404).send('Usuário não encontrado.');
        }
    } catch (erro) {
        res.status(500).send('Erro ao buscar dados do usuário.');
    } finally {
        cliente.close();
    }
});

app.post('/updateusuario', protegerRota, async (req, res) => {
    const { usuario } = req.session;
    const { usuario: novoUsuario } = req.body;

    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuarioExistente = await colecaousuarios.findOne({ usuario: novoUsuario });
        if (usuarioExistente) {
            return res.status(400).send('Nome de usuário já existe.');
        }

        await colecaousuarios.updateOne(
            { usuario: usuario },
            { $set: { usuario: novoUsuario } }
        );

        req.session.usuario = novoUsuario;

        res.send('Usuário atualizado com sucesso!');
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao atualizar o nome de usuário.');
    } finally {
        cliente.close();
    }
});
app.post('/updateemail', protegerRota, async (req, res) => {
    const { usuario } = req.session;
    const { email } = req.body;

    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        await colecaousuarios.updateOne(
            { usuario: usuario },
            { $set: { email: email } }
        );

        res.send('Email atualizado com sucesso!');
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao atualizar o e-mail.');
    } finally {
        cliente.close();
    }
});
app.post('/updatetelefone', protegerRota, async (req, res) => {
    const { usuario } = req.session;
    const { telefone } = req.body;

    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        await colecaousuarios.updateOne(
            { usuario: usuario },
            { $set: { telefone: telefone } }
        );

        res.send('Telefone atualizado com sucesso!');
    } catch (erro) {
        console.error(erro);
        res.status(500).send('Erro ao atualizar o telefone.');
    } finally {
        cliente.close();
    }
});
app.get('/CancelarAssinatura', protegerRota, async (req, res) => {
    const cliente = new MongoClient(urlMongo, { useUnifiedTopology: true });
    try {
        await cliente.connect();
        const banco = cliente.db(nomeBanco);
        const colecaousuarios = banco.collection('usuarios');
        const usuario = await colecaousuarios.findOne({ usuario: req.session.usuario });
        if (usuario) {
            await colecaousuarios.updateOne(
                { usuario: req.session.usuario },
                { $set: { assinante: 0 } }
            );
            res.sendFile(__dirname + '/cancelAss.html');
        } else {
            res.send(`
            <script>
            alert('Cara tu tem uma sorte do caralho nem tem como LMAO.');
            window.location.href = '/menu';
                }
            </script>
        `);
        }
    } catch (error) {
        res.send(`
            <script>
                alert('erro na hora de cancelar sua assinatura.');
                window.location.href = '/menu';
            </script>
        `);
    } finally {
        await cliente.close();
    }
});

app.get('/menu', (req, res) => {
    res.sendFile(__dirname + '/Menu.html');
});

app.get('/conta', (req, res) => {
    if (req.session.usuario) {
        res.redirect('/contalogado');
    } else {
        res.sendFile(__dirname + '/login.html');
    }
});

app.get('/errodeletar', (req, res) => {
    res.sendFile(__dirname + '/ErroDelUs.html');
});
app.get('/errologin', (req, res) => {
    res.sendFile(__dirname + '/ErroLogin.html');
});

app.get('/sobrenos', (req, res) => {
    res.sendFile(__dirname + '/SobreNós.html');
});

app.get('/contato', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/Contato.html');
});

app.get('/cursos', (req, res) => {
    res.sendFile(__dirname + '/Cursos.html');
});

app.get('/clonacartao', protegerRota, (req, res) => {
    res.sendFile(__dirname + '/ClonaCartão.html');
});

app.get('/AI', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/artes', (req, res) => {
    res.sendFile(__dirname + '/Artes.html');
});
app.get('/esportes', (req, res) => {
    res.sendFile(__dirname + '/Esportes.html');
});

app.get('/jogos', (req, res) => {
    res.sendFile(__dirname + '/Jogos.html');
});

app.get('/marketing', (req, res) => {
    res.sendFile(__dirname + '/Marketing.html');
});

app.get('/medicina', (req, res) => {
    res.sendFile(__dirname + '/Medicina.html');
});

app.get('/tecnologia', (req, res) => {
    res.sendFile(__dirname + '/Tecnologia.html');
});

app.get('/sair', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return send.alert('Erro ao sair!');
        }
        res.redirect('/login');
    });
});













































const API_KEY = 'AIzaSyDuaT6rOPiKHXEOQYW9Pw8yDnpvS2FhxS8';
const MODEL_NAME = 'gemini-1.0-pro';


app.use(bodyParser.json());

app.use(express.static(path.resolve('./')));

const GENERATION_CONFIG = {
    temperature: 0.9,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
];


app.post('/api/chat', async (req, res) => {
    const userInput = req.body.message;
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const chat = model.startChat({ generationConfig: GENERATION_CONFIG, safetySettings: SAFETY_SETTINGS, history: [] });
        
        const result = await chat.sendMessage(userInput);
        
        if (result.error) {
            return res.status(500).json({ response: 'Erro: ' + result.error.message });
        }

        const response = result.response.text();
        res.json({ response });
    } catch (error) {
        res.status(500).json({ response: 'Erro encontrado: ' + error.message });
    }
});







app.listen(porta, () => {
    console.log(`Servidor rodando na porta http://localhost:${porta}/menu`);
});
