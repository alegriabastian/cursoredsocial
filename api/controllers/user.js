'use strict'
var bcrypt = require('bcrypt-nodejs')
var mongoosePaginate = require('mongoose-pagination');

var User = require('../models/user');
var Follow = require('../models/follow');
var jwt = require('../services/jwt');

var fs =require('fs');
var path = require('path');



//metodos de prueba
function home(req, res){
    res.status(200).send({
        message:'hola mundo'
    });

}

function pruebas(req, res) {
    res.status(200).send({
        message:'Accion de pruebas en el servidor de nodejs'
    });

}

//registro
function saveUser(req, res){
    var params = req.body;
    var user = new User();

    if(params.name && params.surname && params.nick &&
        params.email && params.password){

        user.name = params.name;
        user.surname = params.surname;
        user.nick = params.nick;
        user.email = params.email;
        user.role = 'ROLE_USER';
        user.image = null;


        //controlar usuarios duplicados / se realiza un OR
        User.find({ $or: [
            {email: user.email.toLowerCase()},
            {nick: user.nick.toLowerCase()}
        ]}).exec((err,users) => {
            if(err) return res.status(500).send({message: 'Error en la peticion de usuarios'});
            
            if(users && users.length >= 1){
                return res.status(200).send({message: 'El usuario que intentas registrar ya existe' }); 
            }else{
            //cifra la password y guarda los datos
                bcrypt.hash(params.password, null, null, (err, hash)=>{
                    user.password = hash;
                    user.save((err, userStored) =>{
                        if(err) return res.status(500).send({message: 'Error al guardar el usuario'})
                        if(userStored){
                            res.status(200).send({user: userStored});
                        }else{
                            res.status(404).send({message:'No se ha registrado el usuario'});
                        }
                    });
                });
            }
        });

    } else {
        res.status(200).send({
            message: 'Envia todos los campos necesarios!!'
        })
    }
}

//login
function loginUser(req, res){
    var params =req.body;
    
    var email = params.email;
    var password = params.password;

    //se esta relizando un AND
    User.findOne({email: email}, (err,user) => {
        if(err) return res.status(500).send({message: 'Error en la peticion'});

        if(user){
            bcrypt.compare(password, user.password, (err, check) =>{
                if(check){
                    //devolver datos de usuario
                    if(params.gettoken){
                        //generar y devolver token
                        return res.status(200).send({
                            token: jwt.createToken(user)
                        });
                    }else{
                        //devolver datos del usuario
                        user.password = undefined;
                        return res.status(200).send({user});
                    }

                }else{
                    return res.status(404).send({message: 'El usuario no se ha podido identificar'});
                }
            })
        }else{
            return res.status(404).send({message: 'El usuario no se ha podido identificar!!'});
        }
    })
}

// conseguir datos de un usuario

function getUser(req, res){
    var userId = req.params.id;
    User.findById(userId, (err, user)=>{
        if (err) return res.status(500).send ({message: 'Error en la peticion'});

        if (!user) return res.status(404).send({message:'El usuario no existe'});

        followThisUser(req.user.sub, userId).then((value) => {
            user.password = undefined;
            return res.status(200).send({
                user, 
                following: value.following, 
                followed: value.followed});
        })
    })
};

async function followThisUser(identity_user_id, user_id){
    var following = await Follow.findOne({"user":identity_user_id, "followed":user_id}).exec().then((follow)=>{
            return follow;
        }).catch((err) => {
            return handleError(err);
        });


    var followed = await Follow.findOne({"user":user_id, "followed":identity_user_id}).exec().then((follow)=>{
            return follow;
        }).catch((err) => {
            return handleError(err);
        });

    return {
        following:following, 
        followed:followed
    }
};

// devolver un listado de usuarios paginado
function getUsers(req, res){
    var identity_user_id = req.user.sub;
    
    var page = 1;
    if(req.params.page ){
        page = req.params.page;
    }
    var itemsPerPage = 3;

    User.find().sort('_id').paginate(page, itemsPerPage, (err, users, total)=> {
        if (err) return res.status(500).send ({message: 'Error en la peticion'});
        
        if (!users) return res.status(404).send({message:'no hay usuarios disponibles'});

        followUsersIds(identity_user_id).then((value)=>{
            
            return res.status(200).send({
                users,
                users_following: value.following,
                users_follow_me: value.followed,
                total,
                pages: Math.ceil(total/itemsPerPage)
            })
        });
        

    });
};

async function followUsersIds(user_id){
    var following = await Follow.find({"user": user_id}).select({'_id':0,'__v':0, 'user':0}).exec().then((follows) =>{
        console.log(follows);
        return follows;
    }).catch((err) => {
        return handleError(err);
    });

    var followed = await Follow.find({"followed": user_id}).select({'_id':0,'__v':0, 'followed':0}).exec().then((follows) =>{
        return follows;
    }).catch((err) => {
        return handleError(err);
    });

    //procesar following ids
    var following_clean =[];

    following.forEach((follow)=>{
        following_clean.push(follow.followed);
    })

    //processar followed ids
    var followed_clean =[];

    followed.forEach((follow)=>{
        followed_clean.push(follow.user);
    })

    console.log(following);
    console.log(followed);
    return {
        following:following_clean, 
        followed:followed_clean
    } 
};

function getCounters(req,res){

    var userId = req.params.sub;
    if(req.params.id){
        userId = req.params.id;
    }
    getCountFollow(userId).then((value) =>{
        return res.status(200).send(value);
    });
}

async function getCountFollow(user_id){
    var following = await Follow.countDocuments({"user":user_id}).exec((err, count) =>{
        if(err) return handleError;
        console.log(count);
        return count;
    })

    var followed = await Follow.countDocuments({"followed":user_id}).exec((err,count)=>{
        if(err) return handleError;
        console.log(count);
        return count;
    })

    return {
        following:following,
        followed:followed
    }
}

// edicion de datos de usuario
function updateUser(req, res){
    var userId = req.params.id;
    var update = req.body;

    // borrar propiedad passowrd
    delete update.password;

    if(userId != req.user.sub){
        return res.status(500). send({message: 'no tienes permiso para actualizar los datos del usuario'});
    } 
    User.findByIdAndUpdate(userId, update,{new:true}, (err, userUpdated)=>{
        if (err) return res.status(500).send ({message: 'Error en la peticion'});

        if (!userUpdated) return res.status(404).send({message: 'no se ha podido actualizar el usuario'});


        return res.status(200).send({user: userUpdated});

    });
}

//subir archivos de imagen/avatar de usuario

function uploadImage(req,res){
    var userId = req.params.id;

    if(req.files){
        var file_path = req.files.image.path;
        console.log(file_path);
        var file_split = file_path.split('\\');
        console.log(file_split);

        var file_name = file_split[2];
        console.log(file_name);

        var ext_split = file_name.split('\.');
        console.log(ext_split);


        var file_ext = ext_split[1];
        console.log(file_ext);

        if(userId != req.user.sub){
            return removeFilesOfUploads(res, file_path, 'no tienes permiso para actualizar los datos del usuario');
        } 

        if(file_ext == 'png'|| file_ext == 'jpg' || file_ext == 'gif' || file_ext == 'jpeg'){
            //actualizar documento de usuario logeado

            User.findByIdAndUpdate(userId, {image: file_name}, {new:true}, (err, userUpdated) =>{
                if (err) return res.status(500).send ({message: 'Error en la peticion'});

                if (!userUpdated) return res.status(404).send({message: 'no se ha podido actualizar el usuario'});
    
                return res.status(200).send({user: userUpdated});
        
            });
        }else{
            return removeFilesOfUploads(res, file_path, 'extension no valida');
        }

    }else{
        return res.status(200).send({message:'no se han subido archivos'})
    }
}

function removeFilesOfUploads(res, file_path, message){
    fs.unlink(file_path, (err) =>{
        return res.status(200).send({message: message})
    });
};

function getImageFiles(req, res){
    var image_file = req.params.imageFile;

    var path_file = './uploads/users/'+image_file;
    fs.exists(path_file, (exists) =>{
        if (exists){
            res.sendFile(path.resolve(path_file));
        }else{
            res.status(200).send({message: 'No existeimagen'})
        }

    })
}


module.exports = {
    home,
    pruebas,
    saveUser,
    loginUser,
    getUser,
    getUsers,
    updateUser,
    uploadImage,
    getImageFiles,
    getCounters
}