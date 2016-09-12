class Vec
{
    constructor(x = 0, y = 0)
    {
        this.x = x;
        this.y = y;
    }
}

class Shape
{
    constructor(w, h) {
        this.color = '#fff';
        this.pos = new Vec;
        this.size = new Vec(w, h);
    }
    collides(shape)
    {
        return shape.bottom > this.top &&
            shape.right > this.left &&
            shape.left < this.right &&
            shape.top < this.bottom;
    }
    get top() {
        return this.pos.y;
    }
    get bottom() {
        return this.pos.y + this.size.y;
    }
    get left() {
        return this.pos.x;
    }
    get right() {
        return this.pos.x + this.size.x;
    }
}

class Ball extends Shape
{
    constructor(diameter)
    {
        super(diameter, diameter);
        this.state = 0;
        this.vel = new Vec;
    }
    draw(context)
    {
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.pos.x + this.size.x / 2,
                    this.pos.y + this.size.y / 2,
                    this.size.x / 2,
                    0, 2 * Math.PI, false);
        context.fill();
    }
}

class Player extends Shape
{
    constructor() {
        super(40, 12);
        this._lastPos = new Vec(null, null);
        this.isPlayer = true;
        this.vel = new Vec;
        this.retries = 2;
        this.ball = null;
    }
    collides(ball)
    {
        if (super.collides(ball)) {
            const center = this.pos.x + this.size.x / 2;
            ball.vel.x += (ball.pos.x - center) * 3;
            return true;
        }
        return false;
    }
    draw(context)
    {
        context.fillStyle = '#fff';
        context.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
    }
    fire()
    {
        if (this.ball) {
            this.ball.vel.y = -200;
            this.ball.vel.x = this.vel.x / 2;
            this.ball.state = 1;
            this.ball = null;
        }
    }
    moveTo(x)
    {
        this.pos.x = x - this.size.x / 2;
    }
    update(dt)
    {
        this.vel.x = (this.pos.x - this._lastPos.x) / dt;
        this.vel.y = (this.pos.y - this._lastPos.y) / dt;
        this._lastPos.x = this.pos.x;
        this._lastPos.y = this.pos.y;
    }
}

class Block extends Shape
{
    constructor()
    {
        super(20, 10);

        this.COLORS = [
            null,
            '#0DFF72',
            '#0DC2FF',
            '#FF0D72',
            '#F538FF',
            '#FF8E0D',
            '#FFE138',
            '#3877FF',
        ];

        this.health = 1;
    }
    collides(ball)
    {
        if (super.collides(ball)) {
            --this.health;
            return true;
        }
        return false;
    }
    draw(context)
    {
        context.fillStyle = this.COLORS[this.health];
        context.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
    }
}

class Level extends Shape
{
    constructor()
    {
        super(256, 240);
        this.blocks = [];
    }
    addBlock(block) {
        this.blocks.push(block);
    }
    draw(context)
    {
        context.fillStyle = '#2020CC';
        context.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
    }
    update(dt) {
        this.blocks = this.blocks.filter(block => block.health > 0);
    }
}

class Timer
{
    constructor(sim, update)
    {
        let accumulator = 0;
        this._time = 0;
        this._listener = (time = this._time) => {
            const delta = (time - this._time) / 1000;
            accumulator += delta;
            while (accumulator > this.step) {
                sim(this.step);
                accumulator -= this.step;
            }

            update(delta);

            if (!this._paused) {
                this._frameId = requestAnimationFrame(this._listener);
            }

            this._time = time;
        }

        this._frameId = null;
        this._paused = true;

        this.step = 1/120;
    }
    pause()
    {
        if (!this._paused) {
            this._paused = true;
            cancelAnimationFrame(this._frameId);
        }
    }
    run()
    {
        if (this._paused) {
            this._paused = false;
            this._listener();
        }
    }
}

class Arkanoid
{
    constructor(canvas)
    {
        this._canvas = canvas;
        this._context = canvas.getContext('2d');
        this._context.scale(2, 2);

        this._audio = Object.create(null);
        this._audioTasks = [];
        this._audioContext = new AudioContext();

        this.player = new Player();
        this.balls = new Set([new Ball(6)]);

        this.levelIndex = 0;
        this.levels = [];

        this.level = null;

        this.timer = new Timer(
            dt => this.update(dt),
            dt => {
                this.player.update(dt);
                this.draw();
            });
    }
    collides(ball)
    {
        const blocks = this.level.blocks;
        for (let i = 0, l = blocks.length; i !== l; ++i) {
            const block = blocks[i];
            if (block.collides(ball)) {
                return block;
            }
        }

        if (this.player.collides(ball)) {
            return this.player;
        }

        return false;
    }
    draw()
    {
        this._context.fillStyle = '#000';
        this._context.fillRect(0, 0,
                               this._canvas.width,
                               this._canvas.height);

        this.level.draw(this._context);
        this.player.draw(this._context);
        this.balls.forEach(ball => ball.draw(this._context));
        this.level.blocks.forEach(block => block.draw(this._context));
    }
    loadAudio(url, id)
    {
        const task = fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this._audioContext.decodeAudioData(arrayBuffer))
            .then(buffer => {
                this._audio[id] = buffer;
            });
        this._audioTasks.push(task);
    }
    loadLevel(url)
    {
        return fetch(url)
            .then(response => response.text())
            .then(text => {
                const level = new Level();

                const rows = text.split('\n');
                const dimensions = rows.shift().split('x').map(parseFloat);

                const blockSize = {
                    x: level.size.x / dimensions[0],
                    y: level.size.y / dimensions[1],
                };

                rows.forEach((row, y) => {
                    row.split('').forEach((type, x) => {
                        if (type === ' ') {
                            return;
                        }
                        const block = new Block();
                        block.pos.x = blockSize.x * x;
                        block.pos.y = blockSize.y * y;
                        block.size.x = blockSize.x;
                        block.size.y = blockSize.y;
                        block.health = type | 0;

                        level.addBlock(block);
                    });
                });

                this.level = level;
                this.reset();
            });
    }
    goToLevel(index)
    {
        this.levelIndex = index;
        this.timer.pause();
        return this.loadLevel(this.levels[index])
            .then(() => this.timer.run());
    }
    playAudio(id)
    {
        const source = this._audioContext.createBufferSource();
        source.connect(this._audioContext.destination);
        source.buffer = this._audio[id];
        source.start(0);
    }
    reset()
    {
        this.player.pos.y = this.level.size.y - 20;
        this.balls.forEach(ball => ball.state = 0);
        this.playAudio('boot');
    }
    restartLevel()
    {
        return this.goToLevel(this.levelIndex);
    }
    start()
    {
        return Promise.all(this._audioTasks)
            .then(() => this.goToLevel(0));
    }
    update(dt) {
        const p = this.player,
              a = this.level;

        this.balls.forEach(b => {
            if (p.left < a.left) {
                p.pos.x = 0;
            } else if (p.right > a.right) {
                p.pos.x = a.right - p.size.x;
            }

            if (b.state === 0) {
                b.pos.x = (p.pos.x + p.size.x / 2) - b.size.y / 2;
                b.pos.y = p.pos.y - b.size.x;

                if (p.ball === null) {
                    p.ball = b;
                }
            } else {
                let block;
                block = this.updateVelocity(b, 'x', dt);
                if (!block) {
                    this.updateVelocity(b, 'y', dt);
                }

                if (block) {
                    if (block.isPlayer) {
                        this.playAudio('bounce1');
                    } else {
                        this.playAudio('bounce' + '23456789'[8 * Math.random() | 0]);
                    }
                }
            }

            this.level.update(dt);

            if (b.top < a.top && b.vel.y < 0) {
                b.vel.y = -b.vel.y;
                this.playAudio('bounce2');
            } else if (b.top > a.bottom) {
                if (this.balls.size > 1) {
                    this.balls.delete(b);
                    this.playAudio('lostball');
                } else {
                    if (p.retries-- <= 0) {
                        p.retries = 2;
                        this.levelIndex = 0;
                        this.restartLevel();
                        return;
                    }
                    this.reset();
                    return;
                }
            }
            if (b.left < a.left && b.vel.x < 0 || b.right > a.right && b.vel.x > 0) {
                this.playAudio('bounce3');
                b.vel.x = -b.vel.x;
            }
        });

        if (this.level.blocks.length === 0) {
            this.goToLevel(this.levelIndex + 1);
        }
    }
    updateVelocity(ball, component, dt)
    {
        const [a, b] = component === 'x' ? ['x', 'y'] : ['y', 'x'];

        ball.pos[b] += ball.vel[b] * dt;
        const block = this.collides(ball);
        if (block) {
            if (ball.vel[b] > 0) {
                ball.pos[b] = block.pos[b] - ball.size[b];
            } else {
                ball.pos[b] = block.pos[b] + block.size[b] + ball.size[b];
            }

            ball.vel[b] = -ball.vel[b];

            if (block.vel) {
                ball.vel[a] += (block.vel[a] - ball.vel[a]) / 2;
            }
        }
        return block;
    }
}

const canvas = document.getElementById('arkanoid');
const arkanoid = new Arkanoid(canvas);

arkanoid.loadAudio('sounds/bounce1.ogg', 'bounce1');
arkanoid.loadAudio('sounds/bounce2.ogg', 'bounce2');
arkanoid.loadAudio('sounds/bounce3.ogg', 'bounce3');
arkanoid.loadAudio('sounds/bounce4.ogg', 'bounce4');
arkanoid.loadAudio('sounds/bounce5.ogg', 'bounce5');
arkanoid.loadAudio('sounds/bounce6.ogg', 'bounce6');
arkanoid.loadAudio('sounds/bounce7.ogg', 'bounce7');
arkanoid.loadAudio('sounds/bounce8.ogg', 'bounce8');
arkanoid.loadAudio('sounds/bounce9.ogg', 'bounce9');
arkanoid.loadAudio('sounds/bounce10.ogg', 'bounce10');
arkanoid.loadAudio('sounds/boot.ogg', 'boot');
arkanoid.loadAudio('sounds/lostball.ogg', 'lostball');
arkanoid.loadAudio('sounds/gameover.ogg', 'gameover');

arkanoid.levels.push(
    'levels/level1.txt',
    'levels/level2.txt',
    'levels/level3.txt'
);

canvas.addEventListener('mousemove', (event) => {
    arkanoid.player.moveTo(event.layerX / 2);
});
canvas.addEventListener('mousedown', (event) => {
    arkanoid.player.fire();
});

arkanoid.start();
