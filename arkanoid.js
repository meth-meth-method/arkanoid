class Vec
{
    constructor(x = 0, y = 0)
    {
        this.x = x;
        this.y = y;
    }
}

class Rect
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
    draw(context)
    {
        context.fillStyle = this.color;
        context.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
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

class Circle
{
    constructor(r)
    {
        this.color = '#fff';
        this.pos = new Vec;
        this.radius = r;
    }
    draw(context)
    {
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.pos.x, this.pos.y,
                    this.radius, 0, 2 * Math.PI, false);
        context.fill();
    }
    get top() {
        return this.pos.y - this.radius;
    }
    get bottom() {
        return this.pos.y + this.radius;
    }
    get left() {
        return this.pos.x - this.radius;
    }
    get right() {
        return this.pos.x + this.radius;
    }
}

class Player extends Rect
{
    constructor() {
        super(40, 12);
        this._lastPos = new Vec(null, null);
        this.vel = new Vec;
        this.retries = 2;
        this.ball = null;
    }
    fire()
    {
        if (this.ball) {
            this.ball.vel.y = -200;
            this.ball.vel.x = this.vel.x / 2;
            this.ball.state = this.ball.STATE_FLYING;
            this.ball = null;
        }
    }
    update(dt)
    {
        this.vel.x = (this.pos.x - this._lastPos.x) / dt;
        this.vel.y = (this.pos.y - this._lastPos.y) / dt;
        this._lastPos.x = this.pos.x;
        this._lastPos.y = this.pos.y;
    }
}

class Block extends Rect
{
    constructor()
    {
        super(20, 10);
        this.health = 1;
    }
    collides(ball)
    {
        if (super.collides(ball)) {
            --this.health;
            console.log(this.health);
            return true;
        }
        return false;
    }
}

class Ball extends Circle
{
    constructor()
    {
        super(3);
        this.STATE_ATTACHED = 0;
        this.STATE_FLYING = 1;

        this.state = 0;
        this.vel = new Vec;
    }
}

class Level
{
    constructor()
    {
        this.arena = new Rect(256, 240);
        this.arena.color = '#2020CC';

        this.blocks = [];
    }
    addBlock(block) {
        this.blocks.push(block);
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

        this.player = new Player();
        this.ball = new Ball();

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

        this.drawShape(this.level.arena);

        this.drawShape(this.player);
        this.drawShape(this.ball);
        this.level.blocks.forEach(block => this.drawShape(block));

    }
    drawShape(shape)
    {
        shape.draw(this._context);
    }
    loadLevel(url)
    {
        const colors = [
            null,
            '#FF0D72',
            '#0DC2FF',
            '#0DFF72',
            '#F538FF',
            '#FF8E0D',
            '#FFE138',
            '#3877FF',
        ];

        return fetch(url)
            .then(response => response.text())
            .then(text => {
                const level = new Level();

                const rows = text.split('\n');
                const dimensions = rows.shift().split('x').map(parseFloat);

                const blockSize = {
                    x: level.arena.size.x / dimensions[0],
                    y: level.arena.size.y / dimensions[1],
                };

                rows.forEach((row, y) => {
                    row.split('').forEach((type, x) => {
                        if (!colors[type]) {
                            return;
                        }
                        const block = new Block();
                        block.pos.x = blockSize.x * x;
                        block.pos.y = blockSize.y * y;
                        block.size.x = blockSize.x;
                        block.size.y = blockSize.y;
                        block.color = colors[type];

                        level.addBlock(block);
                    });
                });

                this.level = level;
                this.reset();
            });
    }
    goToLevel(index)
    {
        this.timer.pause();
        return this.loadLevel(this.levels[index])
            .then(() => this.timer.run());
    }
    reset()
    {
        this.player.pos.y = this.level.arena.size.y - 20;
        this.player.ball = this.ball;
        this.ball.state = this.ball.STATE_ATTACHED;
    }
    start()
    {
        this.goToLevel(0);
    }
    update(dt) {
        const b = this.ball,
              p = this.player,
              a = this.level.arena;

        if (b.state === b.STATE_ATTACHED) {
            b.pos.x = p.pos.x + p.size.x / 2;
            b.pos.y = p.pos.y - b.radius;
        } else {
            let block;
            b.pos.x += b.vel.x * dt;
            if (block = this.collides(b)) {
                if (b.vel.x > 0) {
                    b.pos.x = block.left - b.radius;
                } else {
                    b.pos.x = block.right + b.radius;
                }

                b.vel.x *= -1;
                if (block.vel) {
                    //b.vel.y = b.vel.y + block.vel.y;
                }
            } else {
                b.pos.y += b.vel.y * dt;
                if (block = this.collides(b)) {
                    if (b.vel.y > 0) {
                        b.pos.y = block.top - b.radius;
                    } else {
                        b.pos.y = block.bottom + b.radius;
                    }

                    b.vel.y = -b.vel.y;

                    if (block.vel) {
                        b.vel.x += (block.vel.x - b.vel.x) / 2;
                    }
                }
            }
        }

        this.level.update(dt);

        if (b.top < a.top) {
            b.vel.y = -b.vel.y;
        } else if (b.top > a.bottom) {
            --p.retries;
            this.reset();
            return;
        }
        if (b.left < a.left || b.right > a.right) {
            b.vel.x = -b.vel.x;
        }

        if (this.level.blocks.length === 0) {
            this.goToLevel(++this.levelIndex);
        }
    }
}

const canvas = document.getElementById('arkanoid');
const arkanoid = new Arkanoid(canvas);

arkanoid.levels.push(
    'levels/level1.txt',
    'levels/level2.txt',
    'levels/level3.txt'
);

canvas.addEventListener('mousemove', (event) => {
    arkanoid.player.pos.x = event.layerX;
});
canvas.addEventListener('mousedown', (event) => {
    arkanoid.player.fire();
});

arkanoid.start();
